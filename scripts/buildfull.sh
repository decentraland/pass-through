#! /bin/bash

PASS_THROUGH=PassThrough.sol

OUTPUT=full

npx truffle-flattener contracts/passThrough/$PASS_THROUGH > $OUTPUT/$PASS_THROUGH

