pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

interface PassThrough {
  function allowMethod(string _signature) external;
  function disableMethod(string _signature, uint256 _time) external;
  function owner() external returns (address);
}

contract PassThroughManager is Ownable {
    /**
    * @dev Check if target is owned by the contract.
    * @return bool whether if target owned by the contract or not.
    */
    function isOwner(PassThrough _target) internal view returns (bool) {
        return _target.owner() == address(this);
    }

    /**
    * @dev Disable a method for two years
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _signature string - method signature
    */
    function disableMethod(
        PassThrough _target,
        string memory _signature,
        uint256 _time
    )
        public
        onlyOwner
    {
        _target.disableMethod(_signature, _time);
    }

    /**
    * @dev Allow a method previously disabled
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _target address - passThrough address
    * @param _signature string - method signature
    */
    function allowMethod(PassThrough _target, string memory _signature) public onlyOwner {
        _target.allowMethod(_signature);
    }
}
