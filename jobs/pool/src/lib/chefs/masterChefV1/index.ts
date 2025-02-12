import { ChainId } from 'sushi/chain'
import { SUSHI } from 'sushi/currency'
import { SECONDS_BETWEEN_BLOCKS } from '@sushiswap/graph-config'
import type { Address } from '@wagmi/core'
import { daysInYear, secondsInDay } from 'date-fns'

import { MASTERCHEF_ADDRESS } from '../../../config.js'
import { getPairs, getTokenBalancesOf, getTokens } from '../../common/index.js'
import type { ChefReturn, Farm } from '../../types.js'
import { getPoolInfos, getPoolLength, getTotalAllocPoint } from './fetchers.js'

const SUSHI_PER_BLOCK = 100

export async function getMasterChefV1(): Promise<ChefReturn> {
  const [
    poolLength,
    totalAllocPoint,
    [{ derivedUSD: sushiPriceUSD }],
    averageBlockTime,
  ] = await Promise.all([
    getPoolLength(),
    getTotalAllocPoint(),
    getTokens([SUSHI[ChainId.ETHEREUM].address], ChainId.ETHEREUM),
    SECONDS_BETWEEN_BLOCKS[ChainId.ETHEREUM],
  ])

  const blocksPerDay = averageBlockTime ? secondsInDay / averageBlockTime : 0
  const sushiPerDay = SUSHI_PER_BLOCK * blocksPerDay
  console.log(
    `MasterChefV1 - pools: ${poolLength}, sushiPerDay: ${sushiPerDay}, averageBlockTime: ${averageBlockTime}, totalAllocPoint: ${totalAllocPoint}`,
  )

  const poolInfos = await getPoolInfos(poolLength)

  const [pairs, lpBalances] = await Promise.all([
    getPairs(
      poolInfos.map((pool) => pool.lpToken),
      ChainId.ETHEREUM,
    ),
    getTokenBalancesOf(
      poolInfos.map((pool) => pool.lpToken),
      MASTERCHEF_ADDRESS[ChainId.ETHEREUM] as Address,
      ChainId.ETHEREUM,
    ),
  ])

  return {
    chainId: ChainId.ETHEREUM,
    farms: poolInfos.reduce<Record<string, Farm>>((acc, farm, i) => {
      const pair = pairs.find((pair) => pair.id === farm.lpToken.toLowerCase())
      const lpBalance = lpBalances.find(
        ({ token }) => token === farm.lpToken,
      )?.balance
      if (!pair || !lpBalance) return acc

      const rewardPerDay =
        sushiPerDay * (Number(farm.allocPoint) / Number(totalAllocPoint))
      const rewardPerYearUSD = daysInYear * rewardPerDay * sushiPriceUSD

      const incentives: Farm['incentives'] = [
        {
          apr:
            rewardPerYearUSD /
            ((pair.liquidityUSD * lpBalance) / pair.totalSupply),
          rewardPerDay: rewardPerDay,
          rewardToken: {
            address: SUSHI[ChainId.ETHEREUM].address,
            name: SUSHI[ChainId.ETHEREUM].name ?? '',
            decimals: SUSHI[ChainId.ETHEREUM].decimals ?? 18,
            symbol: SUSHI[ChainId.ETHEREUM].symbol ?? '',
          },
          rewarder: {
            address: MASTERCHEF_ADDRESS[ChainId.ETHEREUM] as Address,
            type: 'Primary',
          },
        },
      ]

      acc[farm.lpToken.toLowerCase()] = {
        id: i,
        incentives: incentives,
        chefType: 'MasterChefV1',
        poolType: pair.type,
      }
      return acc
    }, {}),
  }
}
