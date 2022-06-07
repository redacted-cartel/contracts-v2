import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { Mariposa } from '../typechain';
import { BTRFLYV2 } from '../typechain/BTRFLYV2';
import { toBN, callAndReturnEvents, validateEvent, parseLog } from './helpers';

describe('Mariposa', function () {
  let admin: SignerWithAddress;
  let btrflyV2: BTRFLYV2;
  let mariposa: Mariposa;
  let mariposaSupplyCap: BigNumber;
  let zeroAddress: string;

  before(async function () {
    ({ admin, btrflyV2, mariposa, mariposaSupplyCap, zeroAddress } = this);
  });

  describe('constructor', function () {
    it('Should set up contract state', async function () {
      const _btrflyV2 = await mariposa.btrflyV2();
      const _supplyCap = await mariposa.supplyCap();

      expect(_btrflyV2).to.equal(btrflyV2.address);
      expect(_supplyCap).to.equal(mariposaSupplyCap);
    });
  });

  describe('request', function () {
    it('Should revert if caller is not a minter', async function () {
      const recipient = admin.address;
      const amount = 1;

      await expect(mariposa.request(recipient, amount)).to.be.revertedWith(
        'NotMinter()'
      );
    });

    it('Should revert if amount is zero', async function () {
      await mariposa.addMinter(admin.address);

      const recipient = admin.address;
      const invalidAmount = 0;

      await expect(
        mariposa.request(recipient, invalidAmount)
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('Should revert if recipient is zero address', async function () {
      const invalidRecipient = zeroAddress;
      const amount = 1;

      await expect(
        mariposa.request(invalidRecipient, amount)
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('Should revert if paused', async function () {
      await mariposa.setPauseState(true);

      const recipient = admin.address;
      const amount = 1;

      expect(await mariposa.paused()).to.equal(true);
      await expect(mariposa.request(recipient, amount)).to.be.revertedWith(
        'IsPaused()'
      );
    });

    it('Should amount is greater than allowance', async function () {
      await mariposa.setPauseState(false);

      const mintAllowance = await mariposa.mintAllowances(admin.address);
      const recipient = admin.address;
      const invalidAmount = mintAllowance.add(1);

      expect(mintAllowance.lt(invalidAmount)).to.equal(true);
      await expect(
        mariposa.request(recipient, invalidAmount)
      ).to.be.revertedWith('ExceedsAllowance()');
    });

    it('Should request/mint BTRFLYV2 tokens', async function () {
      const recipient = admin.address;
      const amount = toBN(1e18);

      await mariposa.increaseAllowance(admin.address, amount);

      const btrflyV2BalanceBefore = await btrflyV2.balanceOf(admin.address);
      const emissionsBefore = await mariposa.emissions();
      const mintAllowancesBefore = await mariposa.mintAllowances(admin.address);
      const totalAllowancesBefore = await mariposa.totalAllowances();
      const events = await callAndReturnEvents(mariposa.request, [
        recipient,
        amount,
      ]);
      const requestedEvent = events[0];
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

      validateEvent(requestedEvent, 'Requested(address,address,uint256)', {
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
});
