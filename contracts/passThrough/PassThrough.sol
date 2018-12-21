pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./PassThroughStorage.sol";

contract PassThrough is Ownable, PassThroughStorage {
    /**
    * @dev Constructor of the contract.
    */
    constructor(address _estateRegistry, address _operator) Ownable() public {
        operator = _operator;
        estateRegistry = _estateRegistry;

        // Disable methods
        disableMethod("approve(address,uint256)");
        disableMethod("transferFrom(address,address,uint256)");

    }

    function() external {
        if (isOwner() || (msg.sender == operator && isMethodAllowed(msg.sig))) {
            bool success = estateRegistry.call(msg.data);
            if (!success) {
                revert("Execution error");
            }
        } else {
            revert("Invalid call");
        }
    }

    function isMethodAllowed(bytes4 signature) internal view returns (bool) {
        uint256 expires = disableMethods[signature]; 
        // If expires is 0 or passed
        return expires == 0 || expires < block.timestamp;
    }

    function disableMethod(string memory _method) public onlyOwner {
        // Disable method for two years
        bytes4 signature = convertToBytes4(abi.encodeWithSignature(_method));
        disableMethods[signature] = block.timestamp + (365 * 2 days);
        // TODO: emit Disable event
    }

    function allowMethod(string memory _method) public onlyOwner {
        bytes4 signature = convertToBytes4(abi.encodeWithSignature(_method));
        disableMethods[signature] = 0;
        // TODO: emit Allow event
    }

    function convertToBytes4(bytes memory _signature) internal pure returns (bytes4) {
        require(_signature.length == 4, "Invalid method signature");
        bytes4 signatureBytes4;
        assembly {
            signatureBytes4 := mload(add(_signature, 32))
        }
        return signatureBytes4;
    }
}
