pragma solidity ^0.4.24;


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
