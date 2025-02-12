// @ts-nocheck

import { Page } from '@playwright/test'
import { Fee } from '@sushiswap/base-sdk'
import {
  TRIDENT_CONSTANT_POOL_FACTORY_ADDRESS,
  TRIDENT_STABLE_POOL_FACTORY_ADDRESS,
  TRIDENT_SUPPORTED_CHAIN_IDS,
  TridentChainId,
  computeTridentConstantPoolAddress,
  computeTridentStablePoolAddress,
} from '@sushiswap/trident-sdk'
import {
  SUSHISWAP_V2_FACTORY_ADDRESS,
  computeSushiSwapV2PoolAddress,
} from '@sushiswap/v2-sdk'
import {
  SUSHISWAP_V3_FACTORY_ADDRESS,
  computePoolAddress,
} from '@sushiswap/v3-sdk'
import {
  NextFixture,
  expect,
  test,
} from 'next/experimental/testmode/playwright'
import { Native, SUSHI, Token, Type } from 'sushi/currency'
// import { expect, test } from 'next/experimental/testmode/playwright/msw'
import { zeroAddress } from 'viem'

import { createERC20 } from '../create-erc20'

interface TridentPoolArgs {
  token0: Type
  token1: Type
  amount0: string
  amount1: string
  fee: string
  type: 'CREATE' | 'ADD'
}

interface V2PoolArgs {
  token0: Type
  token1: Type
  amount0: string
  amount1: string
  type: 'CREATE' | 'ADD'
}

interface MigrateArgs {
  minPrice: string
  maxPrice: string
}

interface V3PoolArgs {
  token0: Type
  token1: Type
  startPrice?: string
  minPrice: string
  maxPrice: string
  amount: string
  amountBelongsToToken0: boolean
  type: 'CREATE' | 'ADD'
}

interface IncenvitivePoolArgs {
  token0: Type
  token1: Type
}

if (typeof process.env.NEXT_PUBLIC_CHAIN_ID !== 'string') {
  throw new Error('NEXT_PUBLIC_CHAIN_ID not set')
}

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID)
const NATIVE_TOKEN = Native.onChain(CHAIN_ID)

let FAKE_TOKEN: Token

// let MOCK_TOKEN_1_DP: Token
// let MOCK_TOKEN_6_DP: Token
// let MOCK_TOKEN_8_DP: Token
// let MOCK_TOKEN_18_DP: Token

const BASE_URL = 'http://localhost:3000/pool'

// Global hooks
test.beforeAll(async () => {
  FAKE_TOKEN = await createERC20({
    chainId: CHAIN_ID,
    name: 'FakeToken',
    symbol: 'FT',
    decimals: 18,
  })
})
test.beforeEach(async ({ page, next }) => {
  await mockTokenApi(page, [FAKE_TOKEN])
  next.onFetch(() => {
    return 'continue'
  })
})

// Tests will only work for polygon atm
test.describe('V3', () => {
  test.beforeEach(async ({ page }) => {
    const url = BASE_URL.concat('/add').concat(`?chainId=${CHAIN_ID}`)
    await page.goto(url)
    await switchNetwork(page, CHAIN_ID)
  })

  test('Create pool', async ({ page, next }) => {
    test.slow()
    await createOrAddLiquidityV3(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      startPrice: '0.5',
      minPrice: '0.1',
      maxPrice: '0.9',
      amount: '0.001',
      amountBelongsToToken0: false,
      type: 'CREATE',
    })
  })

  test('Add liquidity, both sides', async ({ page, next }) => {
    test.slow()
    await createOrAddLiquidityV3(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      minPrice: '0.3',
      maxPrice: '0.7',
      amount: '0.0001',
      amountBelongsToToken0: false,
      type: 'ADD',
    })
  })

  test('Add liquidity, only one side(NATIVE)', async ({ page, next }) => {
    test.slow()
    await createOrAddLiquidityV3(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      minPrice: '0.8',
      maxPrice: '0.9',
      amount: '1',
      amountBelongsToToken0: true,
      type: 'ADD',
    })
  })

  test('Add liquidity, only one side(FAKE_TOKEN)', async ({ page, next }) => {
    test.slow()
    await createOrAddLiquidityV3(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      minPrice: '0.2',
      maxPrice: '0.4',
      amount: '0.0001',
      amountBelongsToToken0: false,
      type: 'ADD',
    })
  })

  test('Remove liquidity', async ({ page, next }) => {
    test.slow()
    await mockPoolApi(
      page,
      next,
      NATIVE_TOKEN.wrapped,
      FAKE_TOKEN,
      10000,
      'SUSHISWAP_V3',
    )
    await removeLiquidityV3(page, next)
  })
})

test.describe('Trident', () => {
  console.log(
    'trident',
    !TRIDENT_SUPPORTED_CHAIN_IDS.includes(CHAIN_ID as TridentChainId),
  )
  test.skip(!TRIDENT_SUPPORTED_CHAIN_IDS.includes(CHAIN_ID as TridentChainId))
  test.beforeEach(async ({ page }) => {
    const url = BASE_URL.concat(`/add/trident/${CHAIN_ID}`)
    await page.goto(url)
    await switchNetwork(page, CHAIN_ID)
  })

  test('Create pool', async ({ page, next }) => {
    test.slow()
    await createOrAddTridentPool(page, next, {
      // 0.01% fee is not created at block 42259027
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      amount0: '0.0001',
      amount1: '0.0001',
      fee: Fee.DEFAULT.toString(),
      type: 'CREATE',
    })
  })

  test('Add liquidity', async ({ page, next }) => {
    test.slow()
    await createOrAddTridentPool(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      amount0: '0.0001',
      amount1: '0.0001',
      fee: Fee.DEFAULT.toString(),
      type: 'ADD',
    })
  })

  test('Remove liquidity', async ({ page, next }) => {
    test.slow()
    await mockPoolApi(
      page,
      next,
      NATIVE_TOKEN.wrapped,
      FAKE_TOKEN,
      Fee.DEFAULT,
      'BENTOBOX_CLASSIC',
    )
    const poolAddress = computeTridentConstantPoolAddress({
      factoryAddress: TRIDENT_CONSTANT_POOL_FACTORY_ADDRESS[CHAIN_ID],
      tokenA: NATIVE_TOKEN.wrapped,
      tokenB: FAKE_TOKEN,
      fee: Fee.DEFAULT,
      twap: false,
    })
    const removeLiquidityUrl = BASE_URL.concat(`/${CHAIN_ID}:${poolAddress}`)
    await page.goto(removeLiquidityUrl, { timeout: 25_000 })
    await removeLiquidityV2(page, next)
  })

  test.skip('Add, stake, unstake and remove', async ({ page, next }) => {
    test.slow()
    await createOrAddTridentPool(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      amount0: '0.0001',
      amount1: '0.0001',
      fee: Fee.DEFAULT.toString(),
      type: 'ADD',
    })

    const poolAddress = computeTridentConstantPoolAddress({
      factoryAddress: TRIDENT_CONSTANT_POOL_FACTORY_ADDRESS[CHAIN_ID],
      tokenA: NATIVE_TOKEN.wrapped,
      tokenB: FAKE_TOKEN,
      fee: Fee.DEFAULT,
      twap: false,
    })

    await mockPoolApi(
      page,
      next,
      NATIVE_TOKEN.wrapped,
      FAKE_TOKEN,
      Fee.DEFAULT,
      'BENTOBOX_CLASSIC',
    )

    const addLiquidityUrl = BASE_URL.concat(`/${CHAIN_ID}:${poolAddress}`)
    await page.goto(addLiquidityUrl, { timeout: 25_000 })
    await manageStaking(page, 'STAKE')

    const removeLiquidityUrl = BASE_URL.concat(`/${CHAIN_ID}:${poolAddress}`)
    await page.goto(removeLiquidityUrl, { timeout: 25_000 })
    await manageStaking(page, 'UNSTAKE')
    await page.reload({ timeout: 25_000 })
    await removeLiquidityV2(page, next)
  })

  // test('Migrate', async ({ page }) => {
  //   test.slow()
  //   await createOrAddTridentPool(page, {
  //     token0: NATIVE_TOKEN,
  //     token1: USDC,
  //     amount0: '0.0001',
  //     amount1: '0.0001',
  //     fee: '5',
  //     type: 'ADD',
  //   })

  //   const addLiquidityUrl = BASE_URL.concat('/137:0x846fea3d94976ef9862040d9fba9c391aa75a44b')
  //   await page.goto(addLiquidityUrl, { timeout: 25_000 })
  //   await manageStaking(page, 'STAKE')

  //   const migrateURL = BASE_URL.concat('/137:0x846fea3d94976ef9862040d9fba9c391aa75a44b/migrate')
  //   await page.goto(migrateURL, { timeout: 25_000 })
  //   await manageUnstakeAndClaim(page)
  //   await migrateV2(page, { minPrice: '0.4', maxPrice: '1' })
  // })
})

test.describe('V2', () => {
  test.beforeEach(async ({ page }) => {
    const url = BASE_URL.concat(`/add/v2/${CHAIN_ID}`)
    await page.goto(url)
    await switchNetwork(page, CHAIN_ID)
  })
  test('Create', async ({ page, next }) => {
    test.slow()
    await createOrAddV2Pool(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      amount0: '0.0001',
      amount1: '0.0001',
      type: 'CREATE',
    })
  })

  test('Add liquidity', async ({ page, next }) => {
    test.slow()
    await createOrAddV2Pool(page, next, {
      token0: NATIVE_TOKEN,
      token1: FAKE_TOKEN,
      amount0: '0.0001',
      amount1: '0.0001',
      type: 'ADD',
    })
  })

  test('Remove liquidity', async ({ page, next }) => {
    test.slow()
    const poolAddress = computeSushiSwapV2PoolAddress({
      factoryAddress: SUSHISWAP_V2_FACTORY_ADDRESS[CHAIN_ID],
      tokenA: NATIVE_TOKEN.wrapped,
      tokenB: FAKE_TOKEN,
    })

    await mockPoolApi(
      page,
      next,
      NATIVE_TOKEN.wrapped,
      FAKE_TOKEN,
      Fee.DEFAULT,
      'SUSHISWAP_V2',
    )

    const removeLiquidityUrl = BASE_URL.concat(`/${CHAIN_ID}:${poolAddress}`)
    await page.goto(removeLiquidityUrl)

    await removeLiquidityV2(page, next)
  })
})

async function createOrAddLiquidityV3(
  page: Page,
  next: NextFixture,
  args: V3PoolArgs,
) {
  await handleToken(page, args.token0, 'FIRST')
  await handleToken(page, args.token1, 'SECOND')
  const feeOptionSelector = page.locator('[testdata-id=fee-option-10000]')
  await expect(feeOptionSelector).toBeEnabled()
  await feeOptionSelector.click()
  await expect(feeOptionSelector).toHaveAttribute('data-state', 'on')

  if (args.type === 'CREATE' && args.startPrice) {
    const startPriceInput = page.locator('[testdata-id=start-price-input]')
    await startPriceInput.isVisible()
    await startPriceInput.isEnabled()
    await startPriceInput.fill(args.startPrice, { timeout: 15_000 })
  }
  await page.locator('[testdata-id=min-price-input]').fill(args.minPrice)
  await page.locator('[testdata-id=max-price-input]').fill(args.maxPrice)

  const tokenOrderNumber = args.amountBelongsToToken0 ? 0 : 1
  await page
    .locator(`[testdata-id=add-liquidity-token${tokenOrderNumber}-input]`)
    .fill(args.amount)

  if (
    (args.amountBelongsToToken0 && !args.token0.isNative) ||
    (!args.amountBelongsToToken0 && !args.token1.isNative)
  ) {
    const approveTokenLocator = page.locator(
      `[testdata-id=${`approve-erc20-${tokenOrderNumber}-button`}]`,
    )
    await expect(approveTokenLocator).toBeVisible()
    await expect(approveTokenLocator).toBeEnabled()
    await approveTokenLocator.click()
  }
  const previewLocator = page.locator(
    '[testdata-id=add-liquidity-preview-button]',
  )
  await expect(previewLocator).toBeVisible({ timeout: 10_000 })
  await expect(previewLocator).toBeEnabled()
  await previewLocator.click()
  await page
    .locator('[testdata-id=confirm-add-liquidity-button]')
    .click({ timeout: 5_000 })

  const expectedText =
    args.type === 'ADD'
      ? `(Successfully added liquidity to the ${args.token0.symbol}/${args.token1.symbol} pair)`
      : `(Created the ${args.token0.symbol}/${args.token1.symbol} liquidity pool)`
  const regex = new RegExp(expectedText)
  expect(page.getByText(regex))
}

async function createOrAddTridentPool(
  page: Page,
  next: NextFixture,
  args: TridentPoolArgs,
) {
  await handleToken(page, args.token0, 'FIRST')
  await handleToken(page, args.token1, 'SECOND')

  const poolTypeSelector = page.locator('[testdata-id=pool-type-classic-pool]')
  await expect(poolTypeSelector).toBeVisible()
  await poolTypeSelector.click()
  await page.locator(`[testdata-id=fee-option-${args.fee}]`).click()

  const feeOptionSelector = page.locator(`[testdata-id=fee-option-${args.fee}]`)
  await expect(feeOptionSelector).toBeVisible()
  await feeOptionSelector.click()

  await page
    .locator('[testdata-id=add-liquidity-token0-input]')
    .fill(args.amount0)
  await page
    .locator('[testdata-id=add-liquidity-token1-input]')
    .fill(args.amount1)

  if (args.type === 'CREATE') {
    const approveBentoLocator = page.locator(
      `[testdata-id=create-trident-approve-bentobox-button]`,
    )
    await expect(approveBentoLocator).toBeVisible()
    await expect(approveBentoLocator).toBeEnabled()
    await approveBentoLocator.click()
  }
  const approveTokenId =
    args.type === 'CREATE'
      ? `create-trident-approve-token${args.token0.isNative ? 1 : 0}-button`
      : `add-liquidity-trident-approve-token${
          args.token0.isNative ? 1 : 0
        }-button`

  // create-trident-approve-token1-button
  // add-liquidity-trident-approve-token1-button
  console.log('approveTokenId', approveTokenId)
  const approveTokenLocator = page.locator(`[testdata-id=${approveTokenId}]`)
  await expect(approveTokenLocator).toBeVisible()
  await expect(approveTokenLocator).toBeEnabled()
  await approveTokenLocator.click()

  const reviewSelector =
    args.type === 'CREATE'
      ? '[testdata-id=create-pool-button]'
      : '[testdata-id=add-liquidity-button]'
  const reviewButton = page.locator(reviewSelector)
  await expect(reviewButton).toBeVisible()
  await expect(reviewButton).toBeEnabled()
  await reviewButton.click()

  const confirmButton = page.locator(
    '[testdata-id=confirm-add-liquidity-button]',
  )
  await expect(confirmButton).toBeVisible()
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()

  const expectedText = `(Successfully added liquidity to the ${args.token0.symbol}/${args.token1.symbol} pair)`
  const regex = new RegExp(expectedText)
  expect(page.getByText(regex))
}

async function createOrAddV2Pool(
  page: Page,
  next: NextFixture,
  args: V2PoolArgs,
) {
  await handleToken(page, args.token0, 'FIRST')
  await handleToken(page, args.token1, 'SECOND')
  if (args.type === 'CREATE') {
    const input0 = page.locator('[testdata-id=add-liquidity-token0-input]')
    await expect(input0).toBeEnabled()
    await input0.fill(args.amount0)
    expect(input0).toHaveValue(args.amount0)

    const input1 = page.locator('[testdata-id=add-liquidity-token1-input]')
    await expect(input1).toBeEnabled()
    await input1.fill(args.amount1)
    expect(input1).toHaveValue(args.amount1)
  } else {
    // Only fill in the token that is not native if we are adding liquidity to an existing pool.
    const input = page.locator(
      `[testdata-id=add-liquidity-token${args.token0.isNative ? 1 : 0}-input]`,
    )
    await expect(input).toHaveAttribute('data-state', 'active')
    await expect(input).toBeEnabled()
    await input.fill(args.token0.isNative ? args.amount1 : args.amount0)
    expect(input).toHaveValue(
      args.token0.isNative ? args.amount1 : args.amount0,
    )
  }

  // No diff in approvals between add/create
  // if (args.type === 'ADD') {
  //   const approveTokenId = `approve-token-${args.token0.isNative ? 1 : 0}-button`
  //   const approveTokenLocator = page.locator(`[testdata-id=${approveTokenId}]`)
  //   await expect(approveTokenLocator).toBeVisible()
  //   await expect(approveTokenLocator).toBeEnabled()
  //   await approveTokenLocator.click()
  // }

  const approveTokenId = `approve-token-${args.token0.isNative ? 1 : 0}-button`
  const approveTokenLocator = page.locator(`[testdata-id=${approveTokenId}]`)
  await expect(approveTokenLocator).toBeVisible()
  await expect(approveTokenLocator).toBeEnabled()
  await approveTokenLocator.click()

  const reviewSelector = '[testdata-id=add-liquidity-button]'
  // No diff in selectors between add/create
  // const reviewSelector =
  //   args.type === 'CREATE' ? '[testdata-id=create-pool-button]' : '[testdata-id=add-liquidity-button]'
  const reviewButton = page.locator(reviewSelector)
  await expect(reviewButton).toBeVisible()
  await expect(reviewButton).toBeEnabled()
  await reviewButton.click({ timeout: 2_000 })

  const confirmButton = page.locator(
    '[testdata-id=confirm-add-v2-liquidity-button]',
  )
  await expect(confirmButton).toBeVisible()
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()

  const expectedText = `(Successfully added liquidity to the ${args.token0.symbol}/${args.token1.symbol} pair)`
  const regex = new RegExp(expectedText)
  expect(page.getByText(regex))
}

async function removeLiquidityV3(page: Page, next: NextFixture) {
  await page.goto(BASE_URL)
  await page.locator('[testdata-id=my-positions-button]').click()

  const concentratedPositionTableSelector = page.locator(
    '[testdata-id=concentrated-positions-loading-0]',
  )
  await expect(concentratedPositionTableSelector).not.toBeVisible()

  const firstPositionSelector = page.locator(
    '[testdata-id=concentrated-positions-0-0-td]',
  )
  await expect(firstPositionSelector).toBeVisible()
  await firstPositionSelector.click()

  const removeLiquidityTabSelector = page.locator('[testdata-id=remove-tab]')
  await expect(removeLiquidityTabSelector).toBeVisible()
  await removeLiquidityTabSelector.click()

  await switchNetwork(page, CHAIN_ID)

  await page.locator('[testdata-id=liquidity-max-button]').click()
  const handleLiquidityLocator = page.locator(
    '[testdata-id=remove-or-add-liquidity-button]',
  )
  await expect(handleLiquidityLocator).toBeVisible()
  await expect(handleLiquidityLocator).toBeEnabled() // needed, not sure why, my guess is that a web3 call hasn't finished and button shouldn't be enabled yet.
  await handleLiquidityLocator.click()

  const regex = new RegExp('(Successfully removed liquidity from the .* pair)')
  expect(page.getByText(regex))
}

async function manageUnstakeAndClaim(page: Page) {
  await switchNetwork(page, CHAIN_ID)

  const approveSlpId = `approve-token0-button`
  const approveSlpLocator = page.locator(`[testdata-id=${approveSlpId}]`)
  await expect(approveSlpLocator).toBeVisible()
  await expect(approveSlpLocator).toBeEnabled()
  await approveSlpLocator.click()

  const unstakeId = `unstake-liquidity-button`
  const unstakeLocator = page.locator(`[testdata-id=${unstakeId}]`)
  await expect(unstakeLocator).toBeVisible()
  await expect(unstakeLocator).toBeEnabled()
  await unstakeLocator.click()

  const regex = new RegExp('(Successfully unstaked * * tokens)')
  expect(page.getByText(regex))
}

async function migrateV2(page: Page, args: MigrateArgs) {
  await switchNetwork(page, CHAIN_ID)

  const feeOptionSelector = page.locator('[testdata-id=fee-option-10000]')
  await expect(feeOptionSelector).toBeEnabled()
  await feeOptionSelector.click()
  await expect(feeOptionSelector).toHaveAttribute('data-state', 'on')

  await page.locator('[testdata-id=min-price-input]').fill(args.minPrice)
  await page.locator('[testdata-id=max-price-input]').fill(args.maxPrice)
  await page.locator('[testdata-id=max-price-input]').blur()

  const approveMigrateButton = `approve-migrate-button`
  const approveMigrateButtonLocator = page.locator(
    `[testdata-id=${approveMigrateButton}]`,
  )
  await approveMigrateButtonLocator.scrollIntoViewIfNeeded()

  await expect(approveMigrateButtonLocator).toBeVisible()
  await expect(approveMigrateButtonLocator).toBeEnabled()
  await approveMigrateButtonLocator.click()

  const migrateButton = `migrate-button`
  const migrateButtonLocator = page.locator(`[testdata-id=${migrateButton}]`)
  await migrateButtonLocator.scrollIntoViewIfNeeded()

  await expect(migrateButtonLocator).toBeVisible()
  await expect(migrateButtonLocator).toBeEnabled()
  await migrateButtonLocator.click()

  const migrateConfirmButton = `migrate-confirm-button`
  const migrateConfirmButtonLocator = page.locator(
    `[testdata-id=${migrateConfirmButton}]`,
  )
  await migrateConfirmButtonLocator.scrollIntoViewIfNeeded()

  await expect(migrateConfirmButtonLocator).toBeVisible()
  await expect(migrateConfirmButtonLocator).toBeEnabled()
  await migrateConfirmButtonLocator.click()

  const regex = new RegExp('(Successfully migrated your liquidity)')
  expect(page.getByText(regex))
}

async function manageStaking(page: Page, type: 'STAKE' | 'UNSTAKE') {
  await switchNetwork(page, CHAIN_ID)

  const removeLiquidityTabSelector = page.locator(
    `[testdata-id=${type.toLowerCase()}-tab]`,
  )
  await expect(removeLiquidityTabSelector).toBeVisible()
  await removeLiquidityTabSelector.click()

  const maxButtonSelector = page.locator(
    `[testdata-id=${type.toLowerCase()}-max-button]`,
  )

  await expect(maxButtonSelector).toBeVisible()
  await expect(maxButtonSelector).toBeEnabled()
  await maxButtonSelector.click()
  if (type === 'STAKE') {
    const approveSlpId = `${type.toLowerCase()}-approve-slp-button`
    const approveSlpLocator = page.locator(`[testdata-id=${approveSlpId}]`)
    await expect(approveSlpLocator).toBeVisible()
    await expect(approveSlpLocator).toBeEnabled()
    await approveSlpLocator.click()
  }

  const actionSelector = page.locator(
    `[testdata-id=${type.toLowerCase()}-liquidity-button]`,
  )
  await expect(actionSelector).toBeVisible()
  await expect(actionSelector).toBeEnabled()
  await actionSelector.click({ timeout: 2_000 })

  const regex = new RegExp(
    `(Successfully ${type.toLowerCase()}d .* SLP tokens)`,
  )
  expect(page.getByText(regex))
}

async function removeLiquidityV2(page: Page, next: NextFixture) {
  await switchNetwork(page, CHAIN_ID)

  const removeLiquidityTabSelector = page.locator(`[testdata-id=remove-tab]`)
  await expect(removeLiquidityTabSelector).toBeVisible()
  await removeLiquidityTabSelector.click()

  await page.locator('[testdata-id=remove-liquidity-max-button]').click()

  const approveSlpId = 'approve-remove-liquidity-slp-button'
  const approveSlpLocator = page.locator(`[testdata-id=${approveSlpId}]`)
  await expect(approveSlpLocator).toBeVisible()
  await expect(approveSlpLocator).toBeEnabled()
  await approveSlpLocator.click()

  const removeLiquidityLocator = page.locator(
    '[testdata-id=remove-liquidity-button]',
  )

  await expect(removeLiquidityLocator).toBeVisible()
  await expect(removeLiquidityLocator).toBeEnabled()
  await removeLiquidityLocator.click()

  const regex = new RegExp('(Successfully removed liquidity from the .* pair)')
  expect(page.getByText(regex))
}

// test.describe('Incentivize', () => {
//   test.beforeEach(async ({ page }) => {
//     const url = BASE_URL.concat(`/incentivize`).concat(`?chainId=${CHAIN_ID}`)
//     await page.goto(url)
//     await switchNetwork(page, CHAIN_ID)
//   })

//   test('Incentivize pool', async ({ page }) => {
//     test.slow()
//     await incentivizePool(page, { token0: NATIVE_TOKEN.wrapped, token1: FAKE_TOKEN })
//   })
// })

async function incentivizePool(page: Page, args: IncenvitivePoolArgs) {
  await handleToken(page, args.token0, 'FIRST')
  await handleToken(page, args.token1, 'SECOND')
  const feeOptionSelector = page.locator('[testdata-id=fee-option-500]')
  await expect(feeOptionSelector).toBeEnabled()
  await feeOptionSelector.click()
  await expect(feeOptionSelector).toBeChecked()

  await selectDate('[testdata-id=start-date]', 1, '001', page)
  await selectDate('[testdata-id=end-date]', 0, '002', page)

  const input0 = page.locator('[testdata-id=swap-from-input]')
  await expect(input0).toBeVisible()
  await expect(input0).toBeEnabled()
  await input0.fill('2.4')

  const button0 = page.locator('[testdata-id=swap-from-button-button]')
  await expect(button0).toBeVisible()
  await expect(button0).toBeEnabled()
  await button0.click()

  await page.fill(
    '[testdata-id=swap-from-token-selector-address-input]',
    'SUSHI',
  )
  const rowSelector = page.locator(
    `[testdata-id=swap-from-token-selector-row-${SUSHI[
      CHAIN_ID
    ].address.toLowerCase()}]`,
  )
  await expect(rowSelector).toBeVisible()
  await rowSelector.click()

  const approveTokenId = 'approve-erc20-button'
  const approveTokenLocator = page.locator(`[testdata-id=${approveTokenId}]`)
  await expect(approveTokenLocator).toBeVisible()
  await expect(approveTokenLocator).toBeEnabled()
  await approveTokenLocator.click()

  const previewLocator = page.locator('[testdata-id=incentivize-pool-review]')
  await expect(previewLocator).toBeVisible({ timeout: 10_000 })
  await expect(previewLocator).toBeEnabled()
  await previewLocator.click()
  await page
    .locator('[testdata-id=incentivize-pool-confirm]')
    .click({ timeout: 5_000 })
}

async function handleToken(
  page: Page,
  currency: Type,
  order: 'FIRST' | 'SECOND',
) {
  const selectorInfix = `token${order === 'FIRST' ? 0 : 1}`
  const tokenSelector = page.locator(
    `[testdata-id=${selectorInfix}-select-button]`,
  )
  await expect(tokenSelector).toBeVisible()
  await tokenSelector.click()
  await page.fill(
    `[testdata-id=${selectorInfix}-token-selector-address-input]`,
    currency.symbol as string,
  )
  const rowSelector = page.locator(
    `[testdata-id=${selectorInfix}-token-selector-row-${
      currency.isNative ? zeroAddress : currency.wrapped.address.toLowerCase()
    }]`,
  )
  await expect(rowSelector).toBeVisible()
  await rowSelector.click()
}

async function switchNetwork(page: Page, chainId: number) {
  const networkSelector = page.locator('[testdata-id=network-selector-button]')
  await expect(networkSelector).toBeVisible()
  await expect(networkSelector).toBeEnabled()
  await networkSelector.click()

  const networkToSelect = page.locator(
    `[testdata-id=network-selector-${chainId}]`,
  )
  await expect(networkToSelect).toBeVisible()
  await expect(networkToSelect).toBeEnabled()
  await networkToSelect.click()
}

export async function selectDate(
  selector: string,
  months: number,
  day: string,
  page: Page,
) {
  await page.locator(selector).click()
  for (let i = 0; i < months; i++) {
    await page.locator(`[aria-label="Next Month"]`).click()
  }

  await page
    .locator(
      `div.react-datepicker__day.react-datepicker__day--${day}, div.react-datepicker__day.react-datepicker__day--${day}.react-datepicker__day--weekend`,
    )
    .last()
    .click()

  await page.locator('li.react-datepicker__time-list-item').first().click()
}

async function mockTokenApi(page: Page, tokens: Token[]) {
  await page.route('https://tokens.sushi.com/v0', async (route) => {
    const response = await route.fetch()
    const json = await response.json()
    await route.fulfill({
      json: [
        ...json,
        ...tokens.map((token) => ({
          id: token.id,
          chainId: token.chainId,
          address: token.address.toLowerCase(),
          name: 'FakeToken',
          symbol: 'FT',
          decimals: 18,
          isCommon: false,
          isFeeOnTransfer: false,
        })),
      ],
    })
  })

  // await page.route('https://gateway.ipfs.io/ipns/tokens.uniswap.org', async (route, request) => {
  //   const response = await route.fetch()
  //   const json = await response.json()
  //   json.tokens.push({
  //     chainId: CHAIN_ID,
  //     address: tokenAddress.toLowerCase(),
  //     name: 'FakeToken',
  //     symbol: 'FT',
  //     decimals: 18,
  //   })
  //   await route.fulfill({ response, json })
  // })
}

async function mockPoolApi(
  page: Page,
  next: NextFixture,
  token0: Token,
  token1: Token,
  fee: number,
  protocol:
    | 'SUSHISWAP_V2'
    | 'SUSHISWAP_V3'
    | 'BENTOBOX_STABLE'
    | 'BENTOBOX_CLASSIC',
) {
  next.onFetch((request) => {
    const [tokenA, tokenB] = token0.sortsBefore(token1)
      ? [token0, token1]
      : [token1, token0] // does safety checks

    let address

    if (protocol === 'SUSHISWAP_V3') {
      address = computePoolAddress({
        factoryAddress: SUSHISWAP_V3_FACTORY_ADDRESS[CHAIN_ID],
        tokenA,
        tokenB,
        fee: fee,
      })
    } else if (protocol === 'SUSHISWAP_V2') {
      address = computeSushiSwapV2PoolAddress({
        factoryAddress: SUSHISWAP_V2_FACTORY_ADDRESS[CHAIN_ID],
        tokenA,
        tokenB,
      })
    } else if (protocol === 'BENTOBOX_CLASSIC') {
      address = computeTridentConstantPoolAddress({
        factoryAddress: TRIDENT_CONSTANT_POOL_FACTORY_ADDRESS[CHAIN_ID],
        tokenA,
        tokenB,
        fee,
        twap: false,
      })
    } else if (protocol === 'BENTOBOX_STABLE') {
      address = computeTridentStablePoolAddress({
        factoryAddress: TRIDENT_STABLE_POOL_FACTORY_ADDRESS[CHAIN_ID],
        tokenA,
        tokenB,
        fee,
      })
    }

    const mockPool = {
      id: `${CHAIN_ID}:${address}`.toLowerCase(),
      address: address.toLowerCase(),
      name: `${tokenA.symbol}-${tokenB.symbol}`,
      chainId: CHAIN_ID,
      protocol,
      swapFee: fee / (protocol === 'SUSHISWAP_V3' ? 1000000 : 10000),
      twapEnabled: false,
      totalSupply: '83920283456658325128353',
      liquidityUSD: '0',
      volumeUSD: '0',
      feeApr1h: 0,
      feeApr1d: 0,
      feeApr1w: 0,
      feeApr1m: 0,
      totalApr1h: 0,
      totalApr1d: 0,
      totalApr1w: 0,
      totalApr1m: 0,
      incentiveApr: 0,
      isIncentivized: false,
      wasIncentivized: false,
      fees1h: '0',
      fees1d: '0',
      fees1w: '0',
      fees1m: '0',
      feesChange1h: 0,
      feesChange1d: 0,
      feesChange1w: 0,
      feesChange1m: 0,
      volume1h: '0',
      volume1d: '0',
      volume1w: '0',
      volume1m: '0',
      volumeChange1h: 0,
      volumeChange1d: 0,
      volumeChange1w: 0,
      volumeChange1m: 0,
      liquidityUSDChange1h: 0,
      liquidityUSDChange1d: 0,
      liquidityUSDChange1w: 0,
      liquidityUSDChange1m: 0,
      isBlacklisted: false,
      token0: {
        id: `${tokenA.chainId}:${tokenA.address}`.toLowerCase(),
        address: tokenA.address.toLowerCase(),
        name: tokenA.name,
        symbol: tokenA.symbol,
        decimals: tokenA.decimals,
        chainId: tokenA.chainId,
      },
      token1: {
        id: `${tokenB.chainId}:${tokenB.address}`.toLowerCase(),
        address: tokenB.address.toLowerCase(),
        name: tokenB.name,
        symbol: tokenB.symbol,
        decimals: tokenB.decimals,
        chainId: tokenB.chainId,
      },
      incentives: [],
      hadEnabledSteerVault: false,
      hasEnabledSteerVault: false,
      steerVaults: [],
    }

    if (request.url === 'https://pools.sushi.com/api/v0') {
      return new Response(JSON.stringify([mockPool]), {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } else if (
      request.url === `https://pools.sushi.com/api/v0/${CHAIN_ID}/${address}`
    ) {
      return new Response(JSON.stringify(mockPool), {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
    return 'continue'
  })
}

// async function mockPoolCountApi(page: Page) {
//   await page.route('https://pools.sushi.com/api/v0/count**', async (route, request) => {
//     const json = {count: 1}
//   await route.fulfill({ json });
//   })
// }
