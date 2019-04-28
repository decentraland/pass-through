pragma solidity ^0.4.24;

// File: openzeppelin-solidity/contracts/ownership/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor () internal {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @return the address of the owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner());
        _;
    }

    /**
     * @return true if `msg.sender` is the owner of the contract.
     */
    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    /**
     * @dev Allows the current owner to relinquish control of the contract.
     * @notice Renouncing to ownership will leave the contract without an owner.
     * It will not be possible to call the functions with the `onlyOwner`
     * modifier anymore.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0));
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// File: contracts/passThrough/PassThroughManager.sol

interface IPassThrough {
  function allowMethod(string _signature) external;
  function disableMethod(string _signature, uint256 _time) external;
  function owner() external returns (address);
}


contract PassThroughManager is Ownable {
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
