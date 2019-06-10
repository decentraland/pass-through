pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

interface IPassThrough {
  function allowMethod(string _signature) external;
  function disableMethod(string _signature, uint256 _time) external;
  function owner() external returns (address);
}


contract PassThroughManager is Ownable {
    // Maximum time where a method can be disabled
    uint256 public constant MAX_TIME = 1609459199; // Seconds for 12/31/2020

    /**
    * @dev Check if the target is owned by the contract
    * @return bool whether the target is owned by the contract or not
    */
    function isOwner(IPassThrough _target) public view returns (bool) {
        return _target.owner() == address(this);
    }

    /**
    * @dev Disable a method for a specific amount of time
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _target address - passThrough address
    * @param _signature string - method signature
    * @param _time uint256 - time to be disabled
    */
    function disableMethod(
        IPassThrough _target,
        string memory _signature,
        uint256 _time
    )
        public
        onlyOwner
    {
        // Avoid overflow
        require(
            MAX_TIME >= block.timestamp && _time <= MAX_TIME - block.timestamp,
            "The time should be lower than permitted"
        );
        _target.disableMethod(_signature, _time);
    }

    /**
    * @dev Allow a method previously disabled
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _target address - passThrough address
    * @param _signature string - method signature
    */
    function allowMethod(IPassThrough _target, string memory _signature) public onlyOwner {
        _target.allowMethod(_signature);
    }
}
