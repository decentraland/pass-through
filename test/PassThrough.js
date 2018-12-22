import assertRevert from './helpers/assertRevert'
import { increaseTime, duration } from './helpers/increaseTime'

const BigNumber = web3.BigNumber
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const AssetRegistryToken = artifacts.require('AssetRegistryTest')
const PassThrough = artifacts.require('PassThrough')

function assertEvent(log, expectedEventName, expectedArgs) {
  const { event, args } = log
  event.should.be.eq(expectedEventName)

  if (expectedArgs) {
    for (let key in expectedArgs) {
      let value = args[key]
      value.should.be.equal(expectedArgs[key], `[assertEvent] ${key}`)
    }
  }
}

async function getEvents(contract, eventName) {
  return new Promise((resolve, reject) => {
    contract[eventName]().get(function(err, logs) {
      if (err) reject(new Error(`Error fetching the ${eventName} events`))
      resolve(logs)
    })
  })
}

function getBlock(blockNumber = 'latest') {
  return web3.eth.getBlock(blockNumber)
}

contract('PassThrough', function([_, owner, operator, hacker]) {
  const twoYears = duration.days(365 * 2)
  const transfer = 'transfer(address,uint256)'
  const foo = 'foo()'
  const transferBytes = '0xa9059cbb'
  const approveBytes = '0x095ea7b3'
  const fooBytes = '0xc2985578'

  let passThrough
  let assetRegistry

  const fromOwner = { from: owner }
  const fromOperator = { from: operator }
  const fromHacker = { from: hacker }

  const creationParams = {
    ...fromOwner,
    gas: 6e6,
    gasPrice: 21e9
  }

  beforeEach(async function() {
    assetRegistry = await AssetRegistryToken.new(creationParams)
    passThrough = await PassThrough.new(
      assetRegistry.address,
      operator,
      fromOwner
    )
  })

  describe('constructor', function() {
    it('should create with correct values', async function() {
      const tempPassThrough = await PassThrough.new(
        assetRegistry.address,
        operator,
        fromOwner
      )

      let logs = await getEvents(tempPassThrough, 'MethodDisabled')
      logs.length.should.be.equal(9)

      const blockTime = (await getBlock()).timestamp
      const expires = blockTime + twoYears

      // Check estateRegistry
      const estateRegistry = await tempPassThrough.estateRegistry()
      estateRegistry.should.be.equal(assetRegistry.address)

      // Check Operator
      const contractOperator = await tempPassThrough.operator()
      contractOperator.should.be.equal(operator)

      // Check if methods are set correctly
      let expiresIn = await tempPassThrough.disableMethods(fooBytes)
      expiresIn.should.be.bignumber.equal(0)

      expiresIn = await tempPassThrough.disableMethods(approveBytes)

      expiresIn.should.be.bignumber.equal(expires)
    })
  })

  describe('disableMethod', function() {
    it('should disable method', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)
      await passThrougMask.transfer(operator, 1, fromOperator)

      const { logs } = await passThrough.disableMethod(transfer, fromOwner)

      const blockTime = (await getBlock()).timestamp
      const expires = blockTime + twoYears

      assertEvent(logs[0], 'MethodDisabled', {
        _caller: owner,
        _signatureBytes4: transferBytes,
        _signature: transfer
      })

      const expiresIn = await passThrough.disableMethods(transferBytes)
      expiresIn.should.be.bignumber.equal(expires)

      await assertRevert(
        passThrougMask.transfer(operator, 1, fromOperator),
        'Permission denied'
      )
    })
  })

  describe('allowMethod', function() {
    it('should allow method after expired', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)

      await passThrough.disableMethod(transfer, fromOwner)
      await assertRevert(
        passThrougMask.transfer(operator, 1, fromOperator),
        'Permission denied'
      )

      await increaseTime(twoYears + duration.seconds(1))
      await passThrougMask.transfer(operator, 1, fromOperator)
    })

    it('should allow method by contract method', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)

      await passThrough.disableMethod(transfer, fromOwner)
      await assertRevert(
        passThrougMask.transfer(operator, 1, fromOperator),
        'Permission denied'
      )

      const { logs } = await passThrough.allowMethod(transfer, fromOwner)
      assertEvent(logs[0], 'MethodAllowed', {
        _caller: owner,
        _signatureBytes4: transferBytes,
        _signature: transfer
      })

      await passThrougMask.transfer(operator, 1, fromOperator)
    })

    it('reverts when trying to allow a method allowed', async function() {
      await assertRevert(
        passThrough.allowMethod(transfer, fromOwner),
        'Method is already allowed'
      )
    })
  })

  describe('fallback', function() {
    it('should call contract methods :: Owner', async function() {
      await passThrough.disableMethod(foo, fromOwner)
      await passThrough.allowMethod(foo, fromOwner)
    })

    it('should call end-contract methods :: Owner', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)
      await passThrougMask.transfer(operator, 1, fromOwner)
      await passThrougMask.approve(operator, 1, fromOwner)
    })

    it('should call end-contract methods allowed :: Operator', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)
      await passThrougMask.bar(fromOperator)
    })

    it('reverts when calling contract methods :: Operator', async function() {
      await assertRevert(passThrough.allowMethod(transfer, fromOperator))
      await assertRevert(passThrough.disableMethod(transfer, fromOperator))
    })

    it('reverts when calling end-contract methods disabled :: Operator', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)
      await assertRevert(
        passThrougMask.approve(operator, 1, fromOperator),
        'Permission denied'
      )
    })

    it('reverts when calling end-contract methods allowed :: Hacker', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)
      await assertRevert(passThrougMask.bar(fromHacker), 'Permission denied')
    })

    it('reverts when calling contract methods :: Hacker', async function() {
      await assertRevert(passThrough.allowMethod(transfer, fromHacker))
      await assertRevert(passThrough.disableMethod(transfer, fromHacker))
    })

    it('reverts when calling end-contract methods disabled :: Hacker', async function() {
      const passThrougMask = await AssetRegistryToken.at(passThrough.address)
      await assertRevert(
        passThrougMask.approve(operator, 1, fromHacker),
        'Permission denied'
      )
    })
  })
})
