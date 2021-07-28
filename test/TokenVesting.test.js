const {
    time,
    expectEvent,
    expectRevert,
    ether
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const BN = require('bn.js');
const { expect, assert } = require('chai');
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();  

const TokenVesting = artifacts.require("TokenVesting");
const RewardToken = artifacts.require("RewardToken");


contract("TokenVesting", function (accounts) {
    [owner, investor, beneficiary1, beneficiary2, beneficiary3, signer] = accounts;

    const currDate = Math.floor(Date.now() / 1000);
    let investorBalance;
    let beneficiaryBalance;

    beforeEach(async function () {
        token = await RewardToken.new(ether("1000"), {from: owner});
        vesting = await TokenVesting.new(token.address);
    });

    describe("Token Vesting Test Cases", function () {
        
        context("Initialization", function() {
            it("should deploy with correct name", async () => {
                (await token.name()).should.equal("Reward Token");
            });
    
            it('should deploy with correct token symbol', async () => {
                (await token.symbol()).should.equal('RT');
            }); 
    
            it('cannot deploy with zero token address', async () => {
                await expectRevert(
                    TokenVesting.new(ZERO_ADDRESS),
                    "Invalid token address"
                );
            });
    
            it('should deploy with correct total suplly', async () => {
                let totalSupply = await token.totalSupply();
                totalSupply.should.be.bignumber.equal(ether("1000"));
            });
        });
        
        context("Initial timestamp", function() {
            it("should set initial timestamp correctly", async () => {
                await vesting.setInitialTimestamp(currDate);
                let initialTimestamp_ = await vesting.initialTimestamp.call();
                initialTimestamp_.should.be.bignumber.equal(new BN(currDate));
            });
    
            it("cannot set zero initial timestamp", async () => {                
                await expectRevert(
                    vesting.setInitialTimestamp(0),
                    "Invalid initial timestamp"
                ); 
            });

            it("cannot set initial timestamp if it has already set", async () => {   
                await vesting.setInitialTimestamp(currDate);             
                await expectRevert(
                    vesting.setInitialTimestamp(currDate),
                    "Initial timestamp can be set only once"
                ); 
            });
        });

        context("Adding investors", function () {
            it("cannot add investors if arrays have different length", async () => {             
                await expectRevert(
                    vesting.addInvestors(
                        [investor, beneficiary1],
                        [ether("100")],
                        [(TokenVesting.allocation.Seed).toString(), (TokenVesting.allocation.Private).toString()]),
                    "Invalid arrays length"
                ); 
            });

            it("should mint tokens for vesting contract equal to sum of param tokens amount", async () => {             
                await vesting.addInvestors(
                    [investor, beneficiary1],
                    [ether("100"), ether("100")],
                    [(TokenVesting.allocation.Seed).toString(), (TokenVesting.allocation.Private).toString()]
                );
                (await token.balanceOf(vesting.address)).should.be.bignumber.equal(ether("200"));
            });
        });
        context("Withdrawing tokens", function () {
            it("cannot withdraw tokens if initil timestamp not setted", async () => {             
                await expectRevert(
                    vesting.withdrawTokens(),
                    "Initial timestamp not setted"
                );
            });

            it("should withdraw tokens correctly", async () => {        
                await vesting.setInitialTimestamp(currDate);
                await vesting.addInvestors(
                    [investor, beneficiary1],
                    [ether("100"), ether("100")],
                    [(TokenVesting.allocation.Seed).toString(), (TokenVesting.allocation.Private).toString()]
                );
                await vesting.withdrawTokens({from: investor});
                let result = await vesting.withdrawTokens({from: beneficiary1});
                expectEvent(result, "RewardPaid", {investor: beneficiary1, amount: ether("15")});
                investorBalance = await token.balanceOf(investor);
                beneficiaryBalance = await token.balanceOf(beneficiary1);
                investorBalance.should.be.bignumber.equal(ether("10"));
                beneficiaryBalance.should.be.bignumber.equal(ether("15"));
                await time.increase(time.duration.minutes(16));
                await vesting.withdrawTokens({from: investor});
                await vesting.withdrawTokens({from: beneficiary1});
                investorBalance = await token.balanceOf(investor);
                beneficiaryBalance = await token.balanceOf(beneficiary1);
                investorBalance.should.be.bignumber.equal(ether("10.9"));
                beneficiaryBalance.should.be.bignumber.equal(ether("15.85"));
                await time.increase(time.duration.weeks(1));
                await vesting.withdrawTokens({from: investor});
                await vesting.withdrawTokens({from: beneficiary1});
                investorBalance = await token.balanceOf(investor);
                beneficiaryBalance = await token.balanceOf(beneficiary1);
                investorBalance.should.be.bignumber.equal(ether("100"));
                beneficiaryBalance.should.be.bignumber.equal(ether("100"));
            });

            it("should not withdraw tokens if current date less than initial timestamp", async () => {        
                await vesting.setInitialTimestamp(currDate + time.duration.days(1));
                await vesting.addInvestors(
                    [investor, beneficiary1],
                    [ether("100"), ether("100")],
                    [(TokenVesting.allocation.Seed).toString(), (TokenVesting.allocation.Private).toString()]
                );
                await vesting.withdrawTokens({from: investor});
                investorBalance = await token.balanceOf(investor);
                investorBalance.should.be.bignumber.equal(ether("0"));
            });
        });
    });
})