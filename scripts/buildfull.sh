#! /bin/bash

PASS_THROUGH=PassThrough.sol
PASS_THROUGH_MANAGER=PassThroughManager.sol

OUTPUT=full

npx truffle-flattener contracts/passThrough/$PASS_THROUGH > $OUTPUT/$PASS_THROUGH
npx truffle-flattener contracts/passThrough/$PASS_THROUGH_MANAGER > $OUTPUT/$PASS_THROUGH_MANAGER


