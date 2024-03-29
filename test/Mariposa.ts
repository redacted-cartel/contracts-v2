import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { Mariposa } from '../typechain';
import { BTRFLYV2 } from '../typechain/BTRFLYV2';
import {
  toBN,
  callAndReturnEvent,
  callAndReturnEvents,
  validateEvent,
  parseLog,
} from './helpers';

describe('Mariposa', function () {
  let admin: SignerWithAddress;
  let notAdmin: SignerWithAddress;
  let btrflyV2: BTRFLYV2;
  let mariposa: Mariposa;
  let mariposaSupplyCap: BigNumber;
  let zeroAddress: string;

  before(async function () {
    ({ admin, notAdmin, btrflyV2, mariposa, mariposaSupplyCap, zeroAddress } =
      this);
  });

  describe('constructor', function () {
    it('Should set up contract state', async function () {
      const _btrflyV2 = await mariposa.btrflyV2();
      const _supplyCap = await mariposa.supplyCap();

      expect(_btrflyV2).to.equal(btrflyV2.address);
      expect(_supplyCap).to.equal(mariposaSupplyCap);
    });
  });

  describe('mintFor', function () {
    it('Should revert if paused', async function () {
      await mariposa.setPauseState(true);

      const recipient = admin.address;
      const amount = 1;

      expect(await mariposa.paused()).to.equal(true);
      await expect(mariposa.mintFor(recipient, amount)).to.be.revertedWith(
        'Pausable: paused'
      );

      await mariposa.setPauseState(false);
    });

    it('Should revert if caller is not a minter', async function () {
      const recipient = admin.address;
      const amount = 1;

      await expect(mariposa.mintFor(recipient, amount)).to.be.revertedWith(
        'NotMinter()'
      );
    });

    it('Should revert if amount is zero', async function () {
      await mariposa.addMinter(admin.address);

      const recipient = admin.address;
      const invalidAmount = 0;

      await expect(
        mariposa.mintFor(recipient, invalidAmount)
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('Should revert if recipient is zero address', async function () {
      const invalidRecipient = zeroAddress;
      const amount = 1;

      await expect(
        mariposa.mintFor(invalidRecipient, amount)
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('Should amount is greater than allowance', async function () {
      const mintAllowance = await mariposa.mintAllowances(admin.address);
      const recipient = admin.address;
      const invalidAmount = mintAllowance.add(1);

      expect(mintAllowance.lt(invalidAmount)).to.equal(true);
      await expect(
        mariposa.mintFor(recipient, invalidAmount)
      ).to.be.revertedWith('0x11');
    });

    it('Should mint BTRFLYV2 tokens for recipient', async function () {
      const recipient = admin.address;
      const amount = toBN(1e18);

      await mariposa.increaseAllowance(admin.address, amount);

      const btrflyV2BalanceBefore = await btrflyV2.balanceOf(admin.address);
      const emissionsBefore = await mariposa.emissions();
      const mintAllowancesBefore = await mariposa.mintAllowances(admin.address);
      const totalAllowancesBefore = await mariposa.totalAllowances();
      const events = await callAndReturnEvents(mariposa.mintFor, [
        recipient,
        amount,
      ]);
      const mintedForEvent = events[0];
      const mintEvent = parseLog(btrflyV2, events[1]);
      const btrflyV2BalanceAfter = await btrflyV2.balanceOf(admin.address);
      const emissionsAfter = await mariposa.emissions();
      const mintAllowancesAfter = await mariposa.mintAllowances(admin.address);
      const totalAllowancesAfter = await mariposa.totalAllowances();

      expect(await mariposa.isMinter(admin.address)).to.equal(true);
      expect(await mariposa.paused()).to.equal(false);
      expect(mintAllowancesBefore.gte(amount)).to.equal(true);
      expect(mintAllowancesAfter).to.equal(mintAllowancesBefore.sub(amount));
      expect(emissionsAfter).to.equal(emissionsBefore.add(amount));
      expect(totalAllowancesAfter).to.equal(totalAllowancesBefore.sub(amount));
      expect(btrflyV2BalanceAfter.sub(btrflyV2BalanceBefore)).to.equal(amount);

      validateEvent(mintedForEvent, 'MintedFor(address,address,uint256)', {
        minter: admin.address,
        recipient,
        amount,
      });

      validateEvent(mintEvent, 'Transfer(address,address,uint256)', {
        from: zeroAddress,
        to: recipient,
        amount,
      });
    });
  });

  describe('addMinter', function () {
    it('Should revert if not owner', async function () {
      const minter = notAdmin.address;

      await expect(
        mariposa.connect(notAdmin).addMinter(minter)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert if minter is zero address', async function () {
      const invalidMinter = zeroAddress;

      await expect(mariposa.addMinter(invalidMinter)).to.be.revertedWith(
        'ZeroAddress()'
      );
    });

    it('Should revert if minter has already been added', async function () {
      const invalidMinter = admin.address;

      await expect(mariposa.addMinter(invalidMinter)).to.be.revertedWith(
        'AlreadyAdded()'
      );
    });

    it('Should add minter', async function () {
      const minter = notAdmin.address;
      const isMinterBefore = await mariposa.isMinter(minter);
      const addEvent = await callAndReturnEvent(mariposa.addMinter, [minter]);
      const isMinterAfter = await mariposa.isMinter(minter);
      const mintersAfter = await mariposa.minters(1);

      expect(isMinterBefore).to.equal(false);
      expect(isMinterAfter).to.equal(true);
      expect(mintersAfter).to.equal(minter);

      validateEvent(addEvent, 'AddedMinter(address)', {
        minter,
      });
    });
  });

  describe('increaseAllowance', function () {
    it('Should revert if not owner', async function () {
      const minter = notAdmin.address;
      const amount = 1;

      await expect(
        mariposa.connect(notAdmin).increaseAllowance(minter, amount)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert if minter is not minter', async function () {
      const invalidMinter = zeroAddress;
      const amount = 1;

      await expect(
        mariposa.increaseAllowance(invalidMinter, amount)
      ).to.be.revertedWith('NotMinter()');
    });

    it('Should revert if amount is zero', async function () {
      const minter = notAdmin.address;
      const invalidAmount = 0;

      await expect(
        mariposa.increaseAllowance(minter, invalidAmount)
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('Should revert if amount results in supply cap being exceeded', async function () {
      const supplyCap = await mariposa.supplyCap();
      const minter = notAdmin.address;
      const invalidAmount = supplyCap.add(1);

      expect(supplyCap.lt(invalidAmount)).to.equal(true);
      await expect(
        mariposa.increaseAllowance(minter, invalidAmount)
      ).to.be.revertedWith('ExceedsSupplyCap()');
    });

    it('Should increase allowance', async function () {
      const minter = notAdmin.address;
      const amount = 1;
      const mintAllowancesBefore = await mariposa.mintAllowances(minter);
      const increaseEvent = await callAndReturnEvent(
        mariposa.increaseAllowance,
        [minter, amount]
      );
      const mintAllowancesAfter = await mariposa.mintAllowances(minter);

      expect(mintAllowancesAfter).to.equal(mintAllowancesBefore.add(amount));

      validateEvent(increaseEvent, 'IncreasedAllowance(address,uint256)', {
        minter,
        amount,
      });
    });
  });

  describe('decreaseAllowance', function () {
    it('Should revert if not owner', async function () {
      const minter = notAdmin.address;
      const amount = 1;

      await expect(
        mariposa.connect(notAdmin).decreaseAllowance(minter, amount)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert if minter is not minter', async function () {
      const invalidMinter = zeroAddress;
      const amount = 1;

      await expect(
        mariposa.decreaseAllowance(invalidMinter, amount)
      ).to.be.revertedWith('NotMinter()');
    });

    it('Should revert if amount is zero', async function () {
      const minter = notAdmin.address;
      const invalidAmount = 0;

      await expect(
        mariposa.decreaseAllowance(minter, invalidAmount)
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('Should revert if amount is greater than allowance', async function () {
      const minter = notAdmin.address;
      const mintAllowances = await mariposa.mintAllowances(minter);
      const amount = mintAllowances.add(1);

      expect(mintAllowances.lt(amount)).to.equal(true);
      await expect(
        mariposa.decreaseAllowance(minter, amount)
      ).to.be.revertedWith('UnderflowAllowance()');
    });

    it('Should decrease allowance', async function () {
      const minter = notAdmin.address;
      const mintAllowancesBefore = await mariposa.mintAllowances(minter);
      const amount = mintAllowancesBefore;
      const decreaseEvent = await callAndReturnEvent(
        mariposa.decreaseAllowance,
        [minter, amount]
      );
      const mintAllowancesAfter = await mariposa.mintAllowances(minter);

      expect(mintAllowancesAfter).to.equal(mintAllowancesBefore.sub(amount));

      validateEvent(decreaseEvent, 'DecreasedAllowance(address,uint256)', {
        minter,
        amount,
      });
    });
  });

  describe('setPauseState', function () {
    it('Should revert if not called by owner', async function () {
      const state = true;

      await expect(
        mariposa.connect(notAdmin).setPauseState(state)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should pause the contract', async function () {
      const isPausedBefore = await mariposa.paused();
      const state = true;

      await mariposa.setPauseState(state);

      const isPausedAfter = await mariposa.paused();

      expect(isPausedBefore).to.be.false;
      expect(isPausedAfter).to.be.true;
      expect(isPausedAfter).to.equal(state);
    });

    it('Should unpause the contract', async function () {
      const isPausedBefore = await mariposa.paused();
      const state = false;

      await mariposa.setPauseState(state);

      const isPausedAfter = await mariposa.paused();

      expect(isPausedBefore).to.be.true;
      expect(isPausedAfter).to.be.false;
      expect(isPausedAfter).to.equal(state);
    });
  });
});
