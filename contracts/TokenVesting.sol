// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; 

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RewardToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TokenVesting is Ownable{
    using SafeERC20 for RewardToken;

    struct Investor {
        uint256 tokenAmount;
        allocation allocationType;
        uint256 paidAmount;
    }

    enum allocation { Seed, Private }

    uint256 public constant PERIOD = 6 minutes;
    uint256 public constant INITIAL_CLIFF = 10 minutes;
    uint256 public constant VESTING_TIME = 600 minutes;
    uint256 public constant PERCENTAGE = 1e20;

    RewardToken public token;
    uint256 public initialTimestamp;
    uint256 public startDate;
    uint256 public vestingTimeEnd;
    bool public initialTimestampSetted;

    event RewardPaid(address indexed investor, uint256 amount);

    mapping(address => Investor) public investorInfo;

    modifier setTimestampOnlyOnce(bool initialTimestampSetted_) {
        require(!initialTimestampSetted_, "Initial timestamp can be set only once");
        _;
    }

    /**
     * Constructor function
     *
     * 
     */
    constructor (
        address token_
    ) {
        require(token_ != address(0), "Invalid token address");
        token = RewardToken(token_);
    }

    /**
     * @notice Sets the initial timestamp if it is not set
     * @param initialTimestamp_ initial timestamp
     */
    function setInitialTimestamp(uint256 initialTimestamp_) public onlyOwner setTimestampOnlyOnce(initialTimestampSetted) {
        require(initialTimestamp_ != 0, "Invalid initial timestamp");
        initialTimestamp = initialTimestamp_;
        startDate = initialTimestamp + INITIAL_CLIFF;
        vestingTimeEnd = startDate + VESTING_TIME;
        initialTimestampSetted = true;
    }

    /**
     * @notice Adds investors
     * @param investor_ array of addresses of investors
     * @param tokenAmount_ array of token amounts for each investor
     * @param allocationType_ array of allocation types
     */
    function addInvestors(
        address[] memory investor_, 
        uint256[] memory tokenAmount_, 
        allocation[] memory allocationType_
    ) public onlyOwner {
        require(investor_.length == tokenAmount_.length && investor_.length == allocationType_.length, "Invalid arrays length");
        uint256 totalTokenAmount;
        Investor memory investor;
        for(uint i; i < investor_.length; i++) {
            totalTokenAmount += tokenAmount_[i];
            investor.tokenAmount = tokenAmount_[i];
            investor.allocationType = allocationType_[i];
            investorInfo[investor_[i]] = investor;
        }
        token.mint(address(this), totalTokenAmount);        
    }
    
    /**
     * @dev Withdraw reward tokens from distribution contract by investor
     */
    function withdrawTokens() public {
        require(initialTimestamp != 0, "Initial timestamp not setted");
        Investor memory investor = investorInfo[msg.sender];
        uint256 availablePercentage = _calculateUnlockedPercentage(investor.allocationType);
        uint256 rewardAmount = investor.tokenAmount / PERCENTAGE * availablePercentage;
        uint256 rewardToPay = rewardAmount - investor.paidAmount;
        investorInfo[msg.sender].paidAmount = rewardAmount;
        token.safeTransfer(msg.sender, rewardToPay);
        emit RewardPaid(msg.sender, rewardToPay);
    }
    
    function _calculateUnlockedPercentage(allocation allocationType_) private view returns(uint256) {
        uint256 currentTimeStamp = block.timestamp;
        uint256 initialPercentage;
        uint256 remaindPercentage;
        if(currentTimeStamp < initialTimestamp) {
            return 0;
        } else if(currentTimeStamp < startDate) {
            if(allocationType_ == allocation.Seed) {
                return 1e19;
            } else {
                return 15e18;
            }    
        }  else if(currentTimeStamp < vestingTimeEnd) {
            if(allocationType_ == allocation.Seed) {
                initialPercentage = 1e19;
                remaindPercentage = 9e19;
            } else {
                initialPercentage = 15e18;
                remaindPercentage = 85e18;
            }
            uint256 periodCount = ((currentTimeStamp - startDate) / PERIOD);
            uint256 unlockedPercentage = periodCount * 1e18 * remaindPercentage / PERCENTAGE;
            return unlockedPercentage + initialPercentage;
        } else {
            return PERCENTAGE;
        }
    }
}