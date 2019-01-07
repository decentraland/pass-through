pragma solidity ^0.4.24;


contract PassThroughStorage {
    bytes4 public constant ERC721_Received = 0x150b7a02;
    uint256 public constant MAX_EXPIRATION_TIME = (365 * 2 days);
    mapping(bytes4 => uint256) public disableMethods;

    address public estateRegistry;
    address public operator;
    address public target;

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

    event TargetChanged(
      address indexed _caller,
      address indexed _oldTarget,
      address indexed _newTarget
    );
}
