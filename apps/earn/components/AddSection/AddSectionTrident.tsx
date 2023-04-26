import { bentoBoxV1Address, BentoBoxV1ChainId, isBentoBoxV1ChainId } from '@sushiswap/bentobox'
import { tryParseAmount } from '@sushiswap/currency'
import { Pool } from '@sushiswap/client'
import { useIsMounted } from '@sushiswap/hooks'
import {
  ConstantProductPoolState,
  getTridentRouterContractConfig,
  StablePoolState,
  useConstantProductPool,
  useStablePool,
} from '@sushiswap/wagmi'
import { FC, useCallback, useMemo, useState } from 'react'

import { useTokensFromPool } from '../../lib/hooks'
import { AddSectionReviewModalTrident } from './AddSectionReviewModalTrident'
import { AddSectionWidget } from './AddSectionWidget'
import { ZERO } from '@sushiswap/math'
import { Checker } from '@sushiswap/wagmi/future/systems'
import { Signature } from '@ethersproject/bytes'
import { Button } from '@sushiswap/ui/future/components/button'

export const AddSectionTrident: FC<{ pool: Pool }> = ({ pool: _pool }) => {
  const [open, setOpen] = useState(false)
  const chainId = _pool.chainId as BentoBoxV1ChainId
  const isMounted = useIsMounted()
  const [permit, setPermit] = useState<Signature>()
  const { token0, token1 } = useTokensFromPool(_pool)
  const [{ input0, input1 }, setTypedAmounts] = useState<{
    input0: string
    input1: string
  }>({ input0: '', input1: '' })

  // TODO: Standardize fee format
  const [constantProductPoolState, constantProductPool] = useConstantProductPool(
    _pool.chainId,
    token0,
    token1,
    _pool.swapFee * 10000,
    _pool.twapEnabled
  )
  const [stablePoolState, stablePool] = useStablePool(
    _pool.chainId,
    token0,
    token1,
    _pool.swapFee * 10000,
    _pool.twapEnabled
  )

  const [poolState, pool] = useMemo(() => {
    if (_pool.type === 'STABLE_POOL') return [stablePoolState, stablePool]
    if (_pool.type === 'CONSTANT_PRODUCT_POOL') return [constantProductPoolState, constantProductPool]
    return [undefined, undefined]
  }, [constantProductPool, constantProductPoolState, _pool.type, stablePool, stablePoolState])

  const [parsedInput0, parsedInput1] = useMemo(() => {
    return [tryParseAmount(input0, token0), tryParseAmount(input1, token1)]
  }, [input0, input1, token0, token1])

  const onChangeToken0TypedAmount = useCallback(
    (value: string) => {
      if (
        poolState === ConstantProductPoolState.NOT_EXISTS ||
        poolState === StablePoolState.NOT_EXISTS ||
        (pool?.reserve0.equalTo(ZERO) && pool?.reserve1.equalTo(ZERO))
      ) {
        setTypedAmounts((prev) => ({
          ...prev,
          input0: value,
        }))
      } else if (token0 && pool) {
        const parsedAmount = tryParseAmount(value, token0)
        setTypedAmounts({
          input0: value,
          input1: parsedAmount ? pool.priceOf(token0.wrapped).quote(parsedAmount.wrapped).toExact() : '',
        })
      }
    },
    [pool, poolState, token0]
  )

  const onChangeToken1TypedAmount = useCallback(
    (value: string) => {
      if (
        poolState === ConstantProductPoolState.NOT_EXISTS ||
        poolState === StablePoolState.NOT_EXISTS ||
        (pool?.reserve0.equalTo(ZERO) && pool?.reserve1.equalTo(ZERO))
      ) {
        setTypedAmounts((prev) => ({
          ...prev,
          input1: value,
        }))
      } else if (token1 && pool) {
        const parsedAmount = tryParseAmount(value, token1)
        setTypedAmounts({
          input0: parsedAmount ? pool.priceOf(token1.wrapped).quote(parsedAmount.wrapped).toExact() : '',
          input1: value,
        })
      }
    },
    [pool, poolState, token1]
  )

  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <AddSectionWidget
        isFarm={!!_pool.incentives && _pool.incentives.length > 0}
        chainId={_pool.chainId}
        input0={input0}
        input1={input1}
        token0={token0}
        token1={token1}
        onInput0={onChangeToken0TypedAmount}
        onInput1={onChangeToken1TypedAmount}
      >
        <Checker.Connect fullWidth size="md">
          <Checker.Custom
            showGuardIfTrue={
              isMounted &&
              !!poolState &&
              [
                ConstantProductPoolState.NOT_EXISTS,
                ConstantProductPoolState.INVALID,
                StablePoolState.NOT_EXISTS,
                StablePoolState.INVALID,
              ].includes(poolState)
            }
            guard={
              <Button size="md" fullWidth disabled={true}>
                Pool Not Found
              </Button>
            }
          >
            <Checker.Network fullWidth size="xl" chainId={_pool.chainId}>
              <Checker.Amounts fullWidth size="xl" chainId={_pool.chainId} amounts={[parsedInput0, parsedInput1]}>
                <Checker.ApproveBentobox
                  chainId={chainId}
                  id="add-liquidity-trident-approve-bentobox"
                  size="xl"
                  className="whitespace-nowrap"
                  fullWidth
                  contract={getTridentRouterContractConfig(chainId).address}
                  onSignature={setPermit}
                  enabled={Boolean(getTridentRouterContractConfig(chainId).address)}
                >
                  <Checker.ApproveERC20
                    id="add-liquidity-trident-approve-token0"
                    size="xl"
                    className="whitespace-nowrap"
                    fullWidth
                    amount={parsedInput0}
                    contract={bentoBoxV1Address[chainId]}
                    enabled={isBentoBoxV1ChainId(chainId)}
                  >
                    <Checker.ApproveERC20
                      id="add-liquidity-trident-approve-token1"
                      size="xl"
                      className="whitespace-nowrap"
                      fullWidth
                      amount={parsedInput1}
                      contract={bentoBoxV1Address[chainId]}
                      enabled={isBentoBoxV1ChainId(chainId)}
                    >
                      <Button fullWidth onClick={() => setOpen(true)} size="xl">
                        Add Liquidity
                      </Button>
                    </Checker.ApproveERC20>
                  </Checker.ApproveERC20>
                </Checker.ApproveBentobox>
              </Checker.Amounts>
            </Checker.Network>
          </Checker.Custom>
        </Checker.Connect>
      </AddSectionWidget>
      <AddSectionReviewModalTrident
        poolAddress={_pool.id}
        poolState={poolState}
        pool={pool}
        chainId={_pool.chainId as BentoBoxV1ChainId}
        token0={token0}
        token1={token1}
        input0={parsedInput0}
        input1={parsedInput1}
        permit={permit}
        open={open}
        close={close}
        setPermit={setPermit}
      />
    </>
  )
}
