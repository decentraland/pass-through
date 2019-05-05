import assertRevert from './helpers/assertRevert'
import { increaseTime, duration } from './helpers/increaseTime'

const BigNumber = web3.BigNumber
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const AssetRegistryToken = artifacts.require('AssetRegistryTest')
const PassThrough = artifacts.require('PassThrough')
const PassThroughManager = artifacts.require('PassThroughManager')
const ERC20 = artifacts.require('FakeERC20')
const ContractWithPayable = artifacts.require('PayableContract')

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

contract('PassThrough', function([deployer, owner, operator, holder, hacker]) {
  const zeroAddress = '0x0000000000000000000000000000000000000000'
  const twoYears = duration.days(365 * 2)
  const balanceOf = 'balanceOf(address)'
  const ownerOf = 'ownerOf(uint256)'
  const foo = 'foo()'
  const ownerOfBytes = '0x6352211e'
  const approveBytes = '0x095ea7b3'
  const fooBytes = '0xc2985578'
  const tokenOne = 1
  const tokenTwo = 2
  const tokenThree = 3

  let passThrough
  let passThrougMask
  let assetRegistry
  let otherAssetRegistry
  let mana
  let contractWithPayable

  const fromOwner = { from: owner }
  const fromOperator = { from: operator }
  const fromHolder = { from: holder }
  const fromHacker = { from: hacker }

  const creationParams = {
    ...fromOwner,
    gas: 6e6,
    gasPrice: 21e9
  }

  beforeEach(async function() {
    mana = await ERC20.new(creationParams)
    await mana.mint(web3.toWei(10, 'ether'), holder)

    assetRegistry = await AssetRegistryToken.new(creationParams)
    otherAssetRegistry = await AssetRegistryToken.new(creationParams)
    contractWithPayable = await ContractWithPayable.new(creationParams)

    passThrough = await PassThrough.new(
      assetRegistry.address,
      operator,
      fromOwner
    )

    // Disable balanceOf for testing
    await passThrough.disableMethod(balanceOf, twoYears, fromOwner)

    // Mint tokens
    assetRegistry.mint(passThrough.address, tokenOne)
    assetRegistry.mint(passThrough.address, tokenTwo)

    assetRegistry.mint(holder, tokenThree)
    otherAssetRegistry.mint(holder, tokenOne)

    passThrougMask = await AssetRegistryToken.at(passThrough.address)
  })

  // This set should always be the first one because it will increase the node time until 12/31/2020
  describe('PassThroughManager', function() {
    const fromDeployer = { from: deployer }
    const twoDays = duration.days(2)
    const MAX_TIME = 1609459199

    let passThroughManager

    beforeEach(async function() {
      passThroughManager = await PassThroughManager.new()
      await passThrough.transferOwnership(passThroughManager.address, fromOwner)
    })

    it('should be owneable by deployer', async function() {
      const owner = await passThroughManager.owner()
      owner.should.be.equal(deployer)

      let isOwner = await passThroughManager.contract['isOwner'][''](
        fromDeployer
      )
      isOwner.should.be.equal(true)
      isOwner = await passThroughManager.contract['isOwner'][''](fromHacker)
      isOwner.should.be.equal(false)
    })

    it('should own a passThrough', async function() {
      const owner = await passThrough.owner()
      owner.should.be.equal(passThroughManager.address)

      const isOwner = await passThroughManager.isOwner(passThrough.address)
      isOwner.should.be.equal(true)
    })

    it('should set max time to disabled a method equal to 12/31/2020  at contract creation', async function() {
      const maxTime = await passThroughManager.MAX_TIME()
      maxTime.should.be.bignumber.equal(MAX_TIME)

      const date = new Date(maxTime.toNumber() * 1000)
      date.getFullYear().should.be.equal(2020)
      date.getMonth().should.be.equal(11)
      date.getDate().should.be.equal(31)
    })

    it('should disable a method', async function() {
      await passThrougMask.ownerOf(tokenOne, fromOperator)

      await passThroughManager.disableMethod(
        passThrough.address,
        ownerOf,
        twoDays,
        fromDeployer
      )

      const logs = await getEvents(passThrough, 'MethodDisabled')

      const blockTime = (await getBlock()).timestamp
      const expires = blockTime + twoDays

      assertEvent(logs[0], 'MethodDisabled', {
        _caller: passThroughManager.address,
        _signatureBytes4: ownerOfBytes,
        _signature: ownerOf
      })

      const expiresIn = await passThrough.disableMethods(ownerOfBytes)
      expiresIn.should.be.bignumber.equal(expires)

      await assertRevert(
        passThrougMask.ownerOf(tokenOne, fromOperator),
        'Permission denied'
      )
    })

    it('should allow a method', async function() {
      await passThroughManager.disableMethod(
        passThrough.address,
        ownerOf,
        twoDays,
        fromDeployer
      )
      await assertRevert(
        passThrougMask.ownerOf(tokenOne, fromOperator),
        'Permission denied'
      )

      await passThroughManager.allowMethod(
        passThrough.address,
        ownerOf,
        fromDeployer
      )

      const logs = await getEvents(passThrough, 'MethodAllowed')
      assertEvent(logs[0], 'MethodAllowed', {
        _caller: passThroughManager.address,
        _signatureBytes4: ownerOfBytes,
        _signature: ownerOf
      })

      await passThrougMask.ownerOf(tokenOne, fromOperator)
    })

    it('reverts when calling a method by not the owner', async function() {
      await assertRevert(
        passThroughManager.disableMethod(
          passThrough.address,
          ownerOf,
          twoDays,
          fromHacker
        )
      )

      await passThroughManager.disableMethod(
        passThrough.address,
        ownerOf,
        twoDays,
        fromDeployer
      )

      await assertRevert(
        passThroughManager.allowMethod(passThrough.address, ownerOf, fromHacker)
      )
    })

    // This test should always be the last one because it will increase the node time until 12/31/2020
    it('reverts when disabling a method for long than permitted', async function() {
      let blockTime = (await getBlock()).timestamp

      await assertRevert(
        passThroughManager.disableMethod(
          passThrough.address,
          ownerOf,
          MAX_TIME - blockTime + duration.days(1),
          fromDeployer
        ),
        'The time should be lower than permitted'
      )

      blockTime = (await getBlock()).timestamp
      await increaseTime(MAX_TIME - blockTime)

      await assertRevert(
        passThroughManager.disableMethod(
          passThrough.address,
          ownerOf,
          duration.days(1),
          fromDeployer
        ),
        'The time should be lower than permitted'
      )
    })
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

  describe('fallback', function() {
    it('should call contract methods :: Owner', async function() {
      await passThrough.disableMethod(foo, twoYears, fromOwner)
      await passThrough.allowMethod(foo, fromOwner)
    })

    it('should call end-contract methods :: Owner', async function() {
      await passThrougMask.balanceOf(operator, fromOwner)
      await passThrougMask.bar(fromOwner)
    })

    it('should forward revert when calling end-contract methods', async function() {
      await assertRevert(
        passThrougMask.callToRevert(fromOwner),
        'This method has reverted'
      )
      await assertRevert(
        passThrougMask.callToRevert(fromOperator),
        'This method has reverted'
      )
    })

    it('should be call with Ether', async function() {
      let targetBalance = await web3.eth.getBalance(assetRegistry.address)
      targetBalance.should.be.bignumber.equal(0)

      let passThroughBalance = await web3.eth.getBalance(passThrough.address)
      passThroughBalance.should.be.bignumber.equal(0)

      const value = web3.toWei(1, 'Ether')
      await passThrougMask.receiveEther({
        ...fromOwner,
        value
      })

      targetBalance = await web3.eth.getBalance(assetRegistry.address)
      targetBalance.should.be.bignumber.equal(value)

      passThroughBalance = await web3.eth.getBalance(passThrough.address)
      passThroughBalance.should.be.bignumber.equal(0)
    })

    it('should forward Ether when calling a target contract with the fallback function payable', async function() {
      let targetBalance = await web3.eth.getBalance(contractWithPayable.address)
      targetBalance.should.be.bignumber.equal(0)

      let passThroughBalance = await web3.eth.getBalance(passThrough.address)
      passThroughBalance.should.be.bignumber.equal(0)

      const value = web3.toWei(1, 'Ether')
      await passThrough.setTarget(contractWithPayable.address, fromOwner)
      await passThrough.sendTransaction({
        ...fromOwner,
        value
      })

      targetBalance = await web3.eth.getBalance(contractWithPayable.address)
      targetBalance.should.be.bignumber.equal(value)

      passThroughBalance = await web3.eth.getBalance(passThrough.address)
      passThroughBalance.should.be.bignumber.equal(0)
    })

    it('reverts when sending Ether to the target without the fallback function payable', async function() {
      let balance = await web3.eth.getBalance(passThrough.address)
      balance.should.be.bignumber.equal(0)

      const value = web3.toWei(1, 'Ether')
      await assertRevert(
        passThrough.sendTransaction({
          ...fromOwner,
          value
        })
      )
      balance = await web3.eth.getBalance(passThrough.address)
      balance.should.be.bignumber.equal(0)
    })

    it('should call end-contract methods allowed :: Operator', async function() {
      await passThrougMask.bar(fromOperator)
    })

    it('reverts when calling contract methods :: Operator', async function() {
      await assertRevert(passThrough.allowMethod(balanceOf, fromOperator))
      await assertRevert(
        passThrough.disableMethod(balanceOf, twoYears, fromOperator)
      )
    })

    it('reverts when calling end-contract methods disabled :: Operator', async function() {
      await assertRevert(
        passThrougMask.balanceOf(operator, fromOperator),
        'Permission denied'
      )
    })

    it('reverts when calling end-contract methods allowed :: Hacker', async function() {
      await assertRevert(passThrougMask.bar(fromHacker), 'Permission denied')
    })

    it('reverts when calling contract methods :: Hacker', async function() {
      await assertRevert(passThrough.allowMethod(balanceOf, fromHacker))
      await assertRevert(
        passThrough.disableMethod(balanceOf, twoYears, fromHacker)
      )
    })

    it('reverts when calling end-contract methods :: Hacker', async function() {
      await assertRevert(
        passThrougMask.balanceOf(operator, fromHacker),
        'Permission denied'
      )

      await assertRevert(passThrougMask.bar(fromHacker), 'Permission denied')
    })
  })

  describe('disableMethod', function() {
    it('should disable method', async function() {
      const twoDays = duration.days(2)
      await passThrougMask.ownerOf(tokenOne, fromOperator)

      const { logs } = await passThrough.disableMethod(
        ownerOf,
        twoDays,
        fromOwner
      )

      const blockTime = (await getBlock()).timestamp
      const expires = blockTime + twoDays

      assertEvent(logs[0], 'MethodDisabled', {
        _caller: owner,
        _signatureBytes4: ownerOfBytes,
        _signature: ownerOf
      })

      const expiresIn = await passThrough.disableMethods(ownerOfBytes)
      expiresIn.should.be.bignumber.equal(expires)

      await assertRevert(
        passThrougMask.ownerOf(tokenOne, fromOperator),
        'Permission denied'
      )
    })
  })

  describe('allowMethod', function() {
    it('should allow method after expired', async function() {
      await passThrough.disableMethod(ownerOf, twoYears, fromOwner)
      await assertRevert(
        passThrougMask.ownerOf(tokenOne, fromOperator),
        'Permission denied'
      )

      await increaseTime(twoYears + duration.seconds(1))
      await passThrougMask.ownerOf(tokenOne, fromOperator)

      const twoDays = duration.days(2)
      await passThrough.disableMethod(ownerOf, twoDays, fromOwner)
      await assertRevert(
        passThrougMask.ownerOf(tokenOne, fromOperator),
        'Permission denied'
      )

      await increaseTime(twoDays + duration.seconds(1))
      await passThrougMask.ownerOf(tokenOne, fromOperator)
    })

    it('should allow method by contract method', async function() {
      await passThrough.disableMethod(ownerOf, twoYears, fromOwner)
      await assertRevert(
        passThrougMask.ownerOf(tokenOne, fromOperator),
        'Permission denied'
      )

      const { logs } = await passThrough.allowMethod(ownerOf, fromOwner)
      assertEvent(logs[0], 'MethodAllowed', {
        _caller: owner,
        _signatureBytes4: ownerOfBytes,
        _signature: ownerOf
      })

      await passThrougMask.ownerOf(tokenOne, fromOperator)
    })

    it('reverts when trying to allow a method allowed', async function() {
      await assertRevert(
        passThrough.allowMethod(ownerOf, fromOwner),
        'Method is already allowed'
      )
    })
  })

  describe('setTarget', function() {
    let newTarget
    beforeEach(async function() {
      newTarget = await AssetRegistryToken.new(creationParams)
    })

    it('should change target by owner', async function() {
      let target = await passThrough.target()
      target.should.be.equal(assetRegistry.address)

      const { logs } = await passThrough.setTarget(newTarget.address, fromOwner)

      logs.length.should.be.equal(1)
      assertEvent(logs[0], 'TargetChanged', {
        _caller: owner,
        _oldTarget: target,
        _newTarget: newTarget.address
      })

      target = await passThrough.target()
      target.should.be.equal(newTarget.address)
    })

    it('should change target by operator', async function() {
      let target = await passThrough.target()
      target.should.be.equal(assetRegistry.address)

      const { logs } = await passThrough.setTarget(
        newTarget.address,
        fromOperator
      )

      logs.length.should.be.equal(1)
      assertEvent(logs[0], 'TargetChanged', {
        _caller: operator,
        _oldTarget: target,
        _newTarget: newTarget.address
      })

      target = await passThrough.target()
      target.should.be.equal(newTarget.address)
    })

    it('should rescue erc20 tokens', async function() {
      const amount = web3.toWei(10, 'ether')
      let contractBalance = await mana.balanceOf(passThrough.address)
      contractBalance.should.be.bignumber.equal(0)

      let holderBalance = await mana.balanceOf(holder)
      holderBalance.should.be.bignumber.equal(amount)

      await mana.transfer(passThrough.address, amount, fromHolder)

      contractBalance = await mana.balanceOf(passThrough.address)
      contractBalance.should.be.bignumber.equal(amount)

      holderBalance = await mana.balanceOf(holder)
      holderBalance.should.be.bignumber.equal(0)

      passThrougMask = await ERC20.at(passThrough.address)

      await passThrough.setTarget(mana.address, fromOperator)
      await passThrougMask.transfer(holder, amount, fromOperator)

      contractBalance = await mana.balanceOf(passThrough.address)
      contractBalance.should.be.bignumber.equal(0)

      holderBalance = await mana.balanceOf(holder)
      holderBalance.should.be.bignumber.equal(amount)
    })

    it('should rescue ERC721 tokens by the owner', async function() {
      let assetOwner = await otherAssetRegistry.ownerOf(tokenOne)
      assetOwner.should.be.equal(holder)

      await otherAssetRegistry.transferFrom(
        holder,
        passThrough.address,
        tokenOne,
        fromHolder
      )

      assetOwner = await otherAssetRegistry.ownerOf(tokenOne)
      assetOwner.should.be.equal(passThrough.address)

      passThrougMask = await AssetRegistryToken.at(passThrough.address)

      await passThrough.setTarget(otherAssetRegistry.address, fromOperator)
      await passThrougMask.transferFrom(
        passThrough.address,
        holder,
        tokenOne,
        fromOwner
      )
      assetOwner = await otherAssetRegistry.ownerOf(tokenOne)
      assetOwner.should.be.equal(holder)
    })

    it('reverts when changing target to a not contract address', async function() {
      let target = await passThrough.target()
      target.should.be.equal(assetRegistry.address)

      await assertRevert(
        passThrough.setTarget(owner, fromOwner),
        'The target should be a contract and different of the pass-throug contract'
      )
    })

    it('reverts when changing target to be the same as the pass-trough contract', async function() {
      let target = await passThrough.target()
      target.should.be.equal(assetRegistry.address)

      await assertRevert(
        passThrough.setTarget(passThrough.address, fromOwner),
        'The target should be a contract and different of the pass-throug contract'
      )

      await assertRevert(
        passThrough.setTarget(passThrough.address, fromOperator),
        'The target should be a contract and different of the pass-throug contract'
      )
    })

    it('reverts when changing target by hacker', async function() {
      let target = await passThrough.target()
      target.should.be.equal(assetRegistry.address)

      await assertRevert(
        passThrough.setTarget(newTarget.address, fromHacker),
        'Permission denied'
      )
    })
  })

  describe('onERC721Received', function() {
    it('should receive registry tokens', async function() {
      let assetOwner = await assetRegistry.ownerOf(tokenThree)
      assetOwner.should.be.equal(holder)

      await assetRegistry.safeTransferFrom(
        holder,
        passThrough.address,
        tokenThree,
        fromHolder
      )

      assetOwner = await assetRegistry.ownerOf(tokenThree)
      assetOwner.should.be.equal(passThrough.address)
    })

    it('reverts when receiving not registry tokens', async function() {
      let assetOwner = await otherAssetRegistry.ownerOf(tokenOne)
      assetOwner.should.be.equal(holder)

      await assertRevert(
        otherAssetRegistry.safeTransferFrom(
          holder,
          passThrough.address,
          tokenOne,
          fromHolder
        )
      )
    })
  })

  describe('End-2-End', function() {
    beforeEach(async function() {
      assetRegistry = await AssetRegistryToken.new(creationParams)

      // Disable balanceOf for testing
      await passThrough.disableMethod(balanceOf, twoYears, fromOwner)

      // Mint tokens
      assetRegistry.mint(passThrough.address, tokenOne)
      assetRegistry.mint(passThrough.address, tokenTwo)

      passThrougMask = await AssetRegistryToken.at(passThrough.address)

      await passThrough.setTarget(assetRegistry.address, fromOwner)
    })
    describe('Disable methods', function() {
      describe('ERC721', function() {
        describe('approve', function() {
          it('should approve :: owner', async function() {
            let approved = await passThrougMask.getApproved(tokenOne, fromOwner)
            approved.should.be.equal(zeroAddress)

            await passThrougMask.approve(operator, tokenOne, fromOwner)

            approved = await passThrougMask.getApproved(tokenOne, fromOwner)
            approved.should.be.equal(operator)
          })

          it('reverts approve :: operator', async function() {
            let approved = await passThrougMask.getApproved(
              tokenOne,
              fromOperator
            )
            approved.should.be.equal(zeroAddress)

            await assertRevert(
              passThrougMask.approve(operator, tokenOne, fromOperator),
              'Permission denied'
            )

            approved = await passThrougMask.getApproved(tokenOne, fromOperator)
            approved.should.be.equal(zeroAddress)
          })

          it('reverts approve :: hacker', async function() {
            await assertRevert(
              passThrougMask.getApproved(tokenOne, fromHacker),
              'Permission denied'
            )

            await assertRevert(
              passThrougMask.approve(operator, tokenOne, fromHacker),
              'Permission denied'
            )

            const approved = await passThrougMask.getApproved(
              tokenOne,
              fromOperator
            )
            approved.should.be.equal(zeroAddress)
          })
        })

        describe('setApprovalForAll', function() {
          it('should setApprovalForAll :: owner', async function() {
            let isApproved = await passThrougMask.isApprovedForAll(
              passThrough.address,
              operator,
              fromOwner
            )
            isApproved.should.be.equal(false)

            await passThrougMask.setApprovalForAll(operator, true, fromOwner)

            isApproved = await passThrougMask.isApprovedForAll(
              passThrough.address,
              operator,
              fromOwner
            )
            isApproved.should.be.equal(true)
          })

          it('reverts setApprovalForAll :: operator', async function() {
            let isApproved = await passThrougMask.isApprovedForAll(
              passThrough.address,
              operator,
              fromOperator
            )
            isApproved.should.be.equal(false)

            await assertRevert(
              passThrougMask.setApprovalForAll(operator, true, fromOperator),
              'Permission denied'
            )

            isApproved = await passThrougMask.isApprovedForAll(
              passThrough.address,
              operator,
              fromOperator
            )
            isApproved.should.be.equal(false)
          })

          it('reverts setApprovalForAll :: hacker', async function() {
            await assertRevert(
              passThrougMask.isApprovedForAll(
                passThrough.address,
                operator,
                fromHacker
              ),
              'Permission denied'
            )

            await assertRevert(
              passThrougMask.setApprovalForAll(operator, true, fromHacker),
              'Permission denied'
            )

            const isApproved = await passThrougMask.isApprovedForAll(
              passThrough.address,
              operator,
              fromOperator
            )
            isApproved.should.be.equal(false)
          })
        })

        describe('transferFrom', function() {
          it('should transferFrom :: owner', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOwner
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            await passThrougMask.transferFrom(
              passThrough.address,
              operator,
              tokenOne,
              fromOwner
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOwner)
            tokenOneOwner.should.be.equal(operator)
          })

          it('reverts transferFrom :: operator', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOperator
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            await assertRevert(
              passThrougMask.transferFrom(
                passThrough.address,
                operator,
                tokenOne,
                fromOperator
              ),
              'Permission denied'
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOperator)
            tokenOneOwner.should.be.equal(passThrough.address)
          })

          it('reverts transferFrom :: hacker', async function() {
            await assertRevert(
              passThrougMask.ownerOf(tokenOne),
              'Permission denied'
            )

            await assertRevert(
              passThrougMask.transferFrom(
                passThrough.address,
                operator,
                tokenOne,
                fromHacker
              ),
              'Permission denied'
            )

            const tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOperator
            )
            tokenOneOwner.should.be.equal(passThrough.address)
          })
        })

        describe('safeTransferFrom', function() {
          it('should safeTransferFrom :: owner', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOwner
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            await passThrougMask.safeTransferFrom(
              passThrough.address,
              operator,
              tokenOne,
              fromOwner
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOwner)
            tokenOneOwner.should.be.equal(operator)
          })

          it('reverts safeTransferFrom :: operator', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOwner
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            await assertRevert(
              passThrougMask.safeTransferFrom(
                passThrough.address,
                operator,
                tokenOne,
                fromOperator
              ),
              'Permission denied'
            )
          })

          it('reverts safeTransferFrom :: hacker', async function() {
            await assertRevert(
              passThrougMask.ownerOf(tokenOne),
              'Permission denied'
            )

            await assertRevert(
              passThrougMask.safeTransferFrom(
                passThrough.address,
                operator,
                tokenOne,
                fromHacker
              ),
              'Permission denied'
            )
          })
        })
      })

      describe('EstateRegistry', function() {
        describe('transferLand', function() {
          it('should transferLand :: owner', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOwner
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            await passThrougMask.transferLand(0, tokenOne, operator, fromOwner)

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOwner)
            tokenOneOwner.should.be.equal(operator)
          })

          it('reverts transferLand :: operator', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOperator
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            await assertRevert(
              passThrougMask.transferLand(0, tokenOne, operator, fromOperator),
              'Permission denied'
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOperator)
            tokenOneOwner.should.be.equal(passThrough.address)
          })

          it('reverts transferLand :: hacker', async function() {
            await assertRevert(
              passThrougMask.ownerOf(tokenOne),
              'Permission denied'
            )

            await assertRevert(
              passThrougMask.transferLand(0, tokenOne, operator, fromHacker),
              'Permission denied'
            )

            const tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOperator
            )
            tokenOneOwner.should.be.equal(passThrough.address)
          })
        })

        describe('transferManyLands', function() {
          it('should transferManyLands :: owner', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOwner
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            let tokenTwoOwner = await passThrougMask.ownerOf(
              tokenTwo,
              fromOwner
            )
            tokenTwoOwner.should.be.equal(passThrough.address)

            await passThrougMask.transferManyLands(
              0,
              [tokenOne, tokenTwo],
              operator,
              fromOwner
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOwner)
            tokenOneOwner.should.be.equal(operator)

            tokenTwoOwner = await passThrougMask.ownerOf(tokenTwo, fromOwner)
            tokenTwoOwner.should.be.equal(operator)
          })

          it('reverts transferManyLands :: operator', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOperator
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            let tokenTwoOwner = await passThrougMask.ownerOf(
              tokenTwo,
              fromOperator
            )
            tokenTwoOwner.should.be.equal(passThrough.address)

            await assertRevert(
              passThrougMask.transferManyLands(
                0,
                [tokenOne, tokenTwo],
                operator,
                fromOperator
              ),
              'Permission denied'
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOperator)
            tokenOneOwner.should.be.equal(passThrough.address)

            tokenTwoOwner = await passThrougMask.ownerOf(tokenTwo, fromOperator)
            tokenTwoOwner.should.be.equal(passThrough.address)
          })

          it('reverts transferManyLands :: hacker', async function() {
            await assertRevert(
              passThrougMask.ownerOf(tokenOne),
              'Permission denied'
            )

            await assertRevert(
              passThrougMask.transferManyLands(
                0,
                [tokenOne, tokenTwo],
                operator,
                fromHacker
              ),
              'Permission denied'
            )
          })
        })

        describe('safeTransferManyFrom', function() {
          it('should safeTransferManyFrom :: owner', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOwner
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            let tokenTwoOwner = await passThrougMask.ownerOf(
              tokenTwo,
              fromOwner
            )
            tokenTwoOwner.should.be.equal(passThrough.address)

            await passThrougMask.safeTransferManyFrom(
              passThrough.address,
              operator,
              [tokenOne, tokenTwo],
              fromOwner
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOwner)
            tokenOneOwner.should.be.equal(operator)

            tokenTwoOwner = await passThrougMask.ownerOf(tokenTwo, fromOwner)
            tokenTwoOwner.should.be.equal(operator)
          })

          it('reverts safeTransferManyFrom :: operator', async function() {
            let tokenOneOwner = await passThrougMask.ownerOf(
              tokenOne,
              fromOperator
            )
            tokenOneOwner.should.be.equal(passThrough.address)

            let tokenTwoOwner = await passThrougMask.ownerOf(
              tokenTwo,
              fromOperator
            )
            tokenTwoOwner.should.be.equal(passThrough.address)

            await assertRevert(
              passThrougMask.safeTransferManyFrom(
                passThrough.address,
                operator,
                [tokenOne, tokenTwo],
                fromOperator
              ),
              'Permission denied'
            )

            tokenOneOwner = await passThrougMask.ownerOf(tokenOne, fromOperator)
            tokenOneOwner.should.be.equal(passThrough.address)

            tokenTwoOwner = await passThrougMask.ownerOf(tokenTwo, fromOperator)
            tokenTwoOwner.should.be.equal(passThrough.address)
          })

          it('reverts transferManyLands :: hacker', async function() {
            await assertRevert(
              passThrougMask.ownerOf(tokenOne),
              'Permission denied'
            )

            await assertRevert(
              passThrougMask.safeTransferManyFrom(
                passThrough.address,
                operator,
                [tokenOne, tokenTwo],
                fromHacker
              ),
              'Permission denied'
            )
          })
        })
      })
    })
  })
})
