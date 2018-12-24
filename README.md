# pass-through

Pass through contract for District

# Contract Interface

```solidity
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

contract PassThrough is Ownable, PassThroughStorage {
    /**
    * @dev Constructor of the contract.
    */
    constructor(address _estateRegistry, address _operator) Ownable() public

    /**
    * @dev Fallback function could be called by the operator, if the method is allowed, or
    * by the owner. If the call was unsuccessful will revert.
    */
    function() external

    /**
    * @dev Check if sender is the operator
    * @return bool whether is sender is the caller or not
    */
    function isOperator() internal view returns (bool)

    /**
    * @dev Check if a method is allowed
    * @param _signature string - method signature
    * @return bool - whether method is allowed or not
    */
    function isMethodAllowed(bytes4 _signature) internal view returns (bool)

    /**
    * @dev Disable a method for two years
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _signature string - method signature
    */
    function disableMethod(string memory _signature) public onlyOwner

    /**
    * @dev Allow a method previously disabled
    * Note that the input expected is the method signature as 'transfer(address,uint256)'
    * @param _signature string - method signature
    */
    function allowMethod(string memory _signature) public onlyOwner

    /**
    * @dev Convert bytes to bytes4
    * @param _signature bytes - method signature
    * @return bytes4 - method signature in bytes4
    */
    function convertToBytes4(bytes memory _signature) internal pure returns (bytes4)
}
```
