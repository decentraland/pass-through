pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./PassThroughStorage.sol";


contract PassThrough is Ownable, PassThroughStorage {
    /**
    * @dev Constructor of the contract.
    */
    constructor(address _estateRegistry, address _operator) Ownable() public {
        estateRegistry = _estateRegistry;
        operator = _operator;

        // ERC721 methods
        disableMethod("approve(address,uint256)");
        disableMethod("setApprovalForAll(address,bool)");
        disableMethod("transferFrom(address,address,uint256)");
        disableMethod("safeTransferFrom(address,address,uint256)");
        disableMethod("safeTransferFrom(address,address,uint256,bytes)");

        // EstateRegistry methods
        disableMethod("transferLand(uint256,uint256,address)");
        disableMethod("transferManyLands(uint256,uint256[],address)");
        disableMethod("safeTransferManyFrom(address,address,uint256[])");
        disableMethod("safeTransferManyFrom(address,address,uint256[],bytes)");

    }

    /**
    * @dev Fallback function could be called by the operator, if the method is allowed, or
    * by the owner. If the call was unsuccessful will revert.
    */
    function() external {
        require(
            isOperator() && isMethodAllowed(msg.sig) || isOwner(),
            "Permission denied"
        );

        bytes memory _calldata = msg.data;
        uint256 _calldataSize = msg.data.length;
        address _dst = estateRegistry;

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let result := call(sub(gas, 10000), _dst, 0, add(_calldata, 0x20), _calldataSize, 0, 0)
            let size := returndatasize

            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)

            // revert instead of invalid() bc if the underlying call failed with invalid() it already wasted gas.
            // if the call returned error data, forward it
            if eq(result, 0) { revert(ptr, size) }
            return(ptr, size)
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
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            signatureBytes4 := mload(add(_signature, 32))
        }
        return signatureBytes4;
    }
}
