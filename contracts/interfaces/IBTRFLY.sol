// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBTRFLY is IERC20{

    function mint(address account_, uint256 amount_) external;

    function burn(uint256 amount) external virtual;

    function burnFrom(address account_, uint256 amount_) external virtual;

}