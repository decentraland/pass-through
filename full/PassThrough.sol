pragma solidity ^0.5.0;

// File: contracts/passThrough/PassThroughStorage.sol

contract PassThroughStorage {
    mapping(bytes4 => uint256) public disableMethods;

    address public estateRegistry;
    address public operator;

    event MethodAllowed(
      address indexed _caller,
      string indexed _methodSignature
    );

    event MethodDisabled(
      address indexed _caller,
      string indexed _methodSignature
    );
}

// File: contracts/passThrough/PassThrough.sol

// import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Ownable {
    address public owner;

    function initialize (address _owner) internal {
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
}


contract PassThrough is Ownable, PassThroughStorage {
    /**
    * @dev Constructor of the contract.
    */
    constructor(address _estateRegistry, address _operator) public {
        // Initialize owneable
        Ownable.initialize(msg.sender);

        operator = _operator;
        estateRegistry = _estateRegistry;

        // Disable methods
        disableMethod("approve(address,uint256)");
        disableMethod("transferFrom(address,address,uint256)");

    }
    event Bien(string a);
    function() external {
        if (msg.sender == owner || (msg.sender == operator && isMethodAllowed(msg.sig))) {
            (bool success,) = estateRegistry.call(msg.data);
            if (!success) {
                revert("Execution error");
            }
        } else {
            revert("Invalid call");
        }
        emit Bien("aaaaa");
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
