import {expect} from "chai";
import { Contract, Signer } from "ethers";
const hre = require("hardhat");

/**
 * Checks that the vault for BTRFLY is Mariposa
 * @param BTRFLY 
 * @param signer 
 * @param Mariposa_addr 
 */
export async function vaultIsMariposa(BTRFLY: Contract, multisigSigner: Signer, Mariposa_addr: string){
    const vault_addr = await BTRFLY.connect(multisigSigner).vault(); 
    console.log(`\t🔐 The vault which has the ability to mint btrfly tokens is ${vault_addr} 🔐`);
    expect(vault_addr).to.be.equals(Mariposa_addr); 
}

/**
 * Ensures that only Mariposa has the ability to mint btrfly tokens
 * @param BTRFLY 
 * @param multisigSigner 
 * @param mariposaSigner 
 * @param walletAddr 
 * @param txnAmt 
 */
export async function mintBTRFLY(
    BTRFLY: Contract, 
    multisigSigner: Signer, 
    mariposaSigner: Signer, 
    walletAddr: string,
    txnAmt: string
) {
    const balBefore = await BTRFLY.balanceOf(walletAddr);
    console.log(`\tThe balance of the wallet before minting the tokens is ${balBefore}`);
    try {
        await BTRFLY.connect(multisigSigner).mint(walletAddr, txnAmt);    
    }
    catch (Error)
    {
        console.log(`\t🚫 When vault is set to the multisig and error is thrown as tokens are not minted. 🚫`);
    }
    await BTRFLY.connect(mariposaSigner).mint(walletAddr, txnAmt);
    const balAfter = await BTRFLY.balanceOf(walletAddr); 
    console.log(`\t💰 The balance of the wallet after minting with vault set as Mariposa is ${balAfter} 💰`);

    expect(balBefore).to.be.lt(balAfter);
    expect(balAfter).to.be.equals(txnAmt);
}

/**
 * Adds departments that sends requests to mint btrfly tokens
 * @param Mariposa 
 * @param multisigSigner 
 */
export async function addDepartments(
    Mariposa: Contract, 
    multisigSigner: Signer, 
    ) {
    let count1 = await Mariposa.departmentCount();

    // adds a department in Mariposa
    let mintRate1 = "2500000000"; 
    await Mariposa.connect(multisigSigner).addDepartment(mintRate1, 0);

    let count2 = await Mariposa.departmentCount();
    
    // adds another department in Mariposa
    let mintRate2 = "0"; 
    await Mariposa.connect(multisigSigner).addDepartment(mintRate2, 0);

    let count3 = await Mariposa.departmentCount();

    console.log(`\t🏛  The total number of departments that report to Mariposa is now ${count3} 🏛`);
    expect(count1).to.be.equals(count2.sub(1)).to.be.equals(count3.sub(2));
}

/**
 * Sets the address of the departments
 * @param Mariposa 
 * @param multisigSigner 
 * @param department_addr 
 */
export async function setDepartmentAddress(
    Mariposa: Contract, 
    multisigSigner: Signer, 
    department_addr1: string, 
    department_addr2: string
) {
    await Mariposa.connect(multisigSigner).setAddressDepartment(1, department_addr1);
    await Mariposa.connect(multisigSigner).setAddressDepartment(2, department_addr2);
    const id1 = await Mariposa.getAddressDepartment(department_addr1); 
    const id2 = await Mariposa.getAddressDepartment(department_addr2);
    expect(id1).to.be.equals(1);
    expect(id2).to.be.equals(2);
}

/**
 * Checks that we cannot set an extra department address
 * @param Mariposa 
 * @param multisigSigner 
 * @param department_addr1 
 */
export async function setExtraDepartment(Mariposa: Contract, multisigSigner: Signer, department_addr1: string) {
    const count = await Mariposa.departmentCount(); 
    console.log(`\tThe number of departments that was added is ${count}`);

    let extraDepartment = count.add(1); 
    let err; 
    try{
        await Mariposa.connect(multisigSigner).setAddressDepartment(extraDepartment, department_addr1);
        err = `New department address set`
    }
    catch (Error){
        err =  `\tThere are only ${count} departments that exist and so we cannot set a department ${extraDepartment}.`
    }
    console.log(err);
    expect(err).to.be.equals(`\tThere are only ${count} departments that exist and so we cannot set a department ${extraDepartment}.`);
}

/**
 * Adjust the department parameters
 * @param Mariposa 
 * @param multisigSigner 
 * @param rate2 
 * @param target2 
 */
export async function setDepartmentAdjustment(
    Mariposa: Contract, 
    multisigSigner: Signer,  
) {
    // sets adjustment for the second department
    let newMintRate = "5000000000";
    await Mariposa.connect(multisigSigner).setDepartmentAdjustment(newMintRate, 2);

    let department2 = await Mariposa.getDepartment(2);
    let expected_mintRate = department2.mintRate;

    expect(newMintRate).to.equals(expected_mintRate); 
}

/**
 * Logs the total mint rate
 * @param Mariposa 
 */
export async function totalEmissions(Mariposa: Contract) {
    let totalMintRate = await Mariposa.currentEmissions();
    console.log(`\tTotal emissions across all departments is ${totalMintRate}`);

    let count = await Mariposa.departmentCount(); 
    let mintCount = 0;
    for (let i = 1; i <= count; i++){
        let department = await Mariposa.getDepartment(i);
        mintCount += parseInt(department.mintRate);
    }

    expect(totalMintRate).to.equals(mintCount);
}

/**
 * Updates the different department fields by making a call to "distribute"
 * @param Mariposa 
 */
export async function updateDistributions(Mariposa: Contract) {
    // returns the number of departments and the totalSupply being minted
    let count = await Mariposa.departmentCount(); 
    let totalSupply = parseInt(await Mariposa.currentOutstanding());

    // calls distribute on each department
    for (let i = 1; i <= count; i++){
        await Mariposa.distribute(i);
        let departmentBalance = parseInt(await Mariposa.getDepartmentBalance(i));

        totalSupply += departmentBalance; 
    }

    let currentOutstanding = await Mariposa.currentOutstanding();
    expect(currentOutstanding).to.equals(totalSupply);
    
}

/**
 * Fast forward eight hours into the future
 */
export async function fastForwardEightHours() {
    console.log(`\t⌛ Fast forwarding 8 hours`);
    await hre.network.provider.send("evm_increaseTime", [60 * 60 * 8]);
    await hre.network.provider.send("evm_mine");
    for (let i = 1; i <= 60 * 60; i++) { 
        await hre.network.provider.send("evm_mine");
    }
}

/**
 * Calls distribute before and after eight hours have passed
 * @param Mariposa 
 */
export async function epochDistributions(Mariposa: Contract) {
    let count = await Mariposa.departmentCount(); 
    let err; 

    try {
        for (let i = 1; i <= count; i++){
            await Mariposa.distribute(i); 
        }
        err =  `\tWarning! Distribute is being called less than eight hours after the last distribution.`
    }
    catch (Error) {
        fastForwardEightHours(); 
        for (let i = 1; i <= count; i++){
            await Mariposa.distribute(i); 
        }
        err = `\tDistribution call is only occurring after an eight hour period.`
    }
    console.log(err);
    expect(err).to.equals(`\tDistribution call is only occurring after an eight hour period.`);
}

/**
 * Update department budgets correctly through request calls
 * @param Mariposa 
 * @param BTRFLY 
 * @param department_addr1 
 * @param department_addr2 
 * @param departmentSigner1 
 * @param departmentSigner2 
 */
export async function departmentRequests(
    Mariposa: Contract, 
    BTRFLY: Contract, 
    department_addr1: string, 
    department_addr2: string,
    departmentSigner1: Signer, 
    departmentSigner2: Signer
) {

    // balance of BTRFLY tokens present in department 1 before call to request
    const btrfly_department1_before = await BTRFLY.balanceOf(department_addr1);
    let departmentBalance1 = await Mariposa.getDepartmentBalance(1); 
    let requestedAmount = departmentBalance1; 
    await Mariposa.connect(departmentSigner1).request(requestedAmount); 

    // balance of BTRFLY tokens present in department 1 after call to request
    const btrfly_department1_after = await BTRFLY.balanceOf(department_addr1);
    const departmentBalance1_after = await Mariposa.getDepartmentBalance(1);
  
    expect(btrfly_department1_after).to.be.gt(btrfly_department1_before);
    expect(departmentBalance1_after).to.be.equals(departmentBalance1.sub(requestedAmount));


    // balance of BTRFLY tokens present in department 2 before call to request
    const btrfly_department2_before = await BTRFLY.balanceOf(department_addr2);
    let departmentBalance2 = await Mariposa.getDepartmentBalance(2); 
    let requestedAmount2 = departmentBalance2.div(2);
    await Mariposa.connect(departmentSigner2).request(requestedAmount2); 

    // balance of BTRFLY tokens present in department 2 after call to request
    const btrfly_department2_after = await BTRFLY.balanceOf(department_addr2);
    const departmentBalance2_after = await Mariposa.getDepartmentBalance(2);

    expect(btrfly_department2_after).to.be.gt(btrfly_department2_before);
    expect(departmentBalance2_after).to.be.equals(departmentBalance2.sub(requestedAmount2));
}

