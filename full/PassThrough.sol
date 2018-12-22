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

// File: contracts/passThrough/PassThroughStorage.sol

contract PassThroughStorage {
    mapping(bytes4 => uint256) public disableMethods;

    address public estateRegistry;
    address public operator;

    event MethodAllowed(
      address indexed _caller,
      bytes4 indexed _signatureBytes4,
      string _signature
    );

    event MethodDisabled(
      address indexed _caller,
      bytes4 indexed _signatureBytes4,
      string _signature
    );
}

// File: contracts/passThrough/PassThrough.sol

contract PassThrough is Ownable, PassThroughStorage {
    /**
    * @dev Constructor of the contract.
    */
    constructor(address _estateRegistry, address _operator) Ownable() public {
        operator = _operator;
        estateRegistry = _estateRegistry;

        // ERC721 methods
        disableMethod("approve(address,uint256)");
        disableMethod("transferFrom(address,address,uint256)");
        disableMethod("safeTransferFrom(address,address,uint256)");
        disableMethod("safeTransferFrom(address,address,uint256,bytes)");
        disableMethod("setApprovalForAll(address,bool)");

        // EstateRegistry methods
        disableMethod("transferManyLands(uint256,uint256[],address)");
        disableMethod("safeTransferFrom(address,address,uint256[])");
        disableMethod("safeTransferManyFrom(address,address,uint256[],bytes)");
        disableMethod("transferLand(uint256,uint256,address)");

    }

    /**
    * @dev Fallback function could be called by the operator, if the method is allowed, or
    * by the owner. If the call was unsuccessful will revert.
    */
    function() external {
        require(
            isOwner() || (isOperator() && isMethodAllowed(msg.sig)),
            "Permission denied"
        );

        bool success = estateRegistry.call(msg.data);
        if (!success) {
            revert("Execution error");
        }
    }

     /**
    * @dev Check if sender is the operator
    * @return bool whether is sender is the caller or not
    */
    function isOperator() internal view returns (bool) {
        return msg.sender == operator;
    }

    /**
    * @dev Check if a method is allowed
    * @param _signature string - method signature
    * @return bool - whether method is allowed or not
    */
    function isMethodAllowed(bytes4 _signature) internal view returns (bool) {
        return disableMethods[_signature] < block.timestamp;
    }

    /**
    * @dev Disable a method for two years
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _signature string - method signature
    */
    function disableMethod(string memory _signature) public onlyOwner {
        bytes4 signatureBytes4 = convertToBytes4(abi.encodeWithSignature(_signature));
        disableMethods[signatureBytes4] = block.timestamp + (365 * 2 days);

        emit MethodDisabled(msg.sender, signatureBytes4, _signature);
    }

    /**
    * @dev Allow a method previously disabled
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _signature string - method signature
    */
    function allowMethod(string memory _signature) public onlyOwner {
        bytes4 signatureBytes4 = convertToBytes4(abi.encodeWithSignature(_signature));
        require(!isMethodAllowed(signatureBytes4), "Method is already allowed");

        disableMethods[signatureBytes4] = 0;

        emit MethodAllowed(msg.sender, signatureBytes4, _signature);
    }

    /**
    * @dev Convert bytes to bytes4
    * @param _signature bytes - method signature
    * @return bytes4 - method signature in bytes4
    */
    function convertToBytes4(bytes memory _signature) internal pure returns (bytes4) {
        require(_signature.length == 4, "Invalid method signature");
        bytes4 signatureBytes4;
        assembly {
            signatureBytes4 := mload(add(_signature, 32))
        }
        return signatureBytes4;
    }
}
