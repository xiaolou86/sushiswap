import { Transition } from '@headlessui/react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { Chip, CircleIcon } from '@sushiswap/ui'
import { difficultyElements, docsUrl } from 'common/helpers'
import { AcademyIcon } from 'common/icons'
import { FC, Fragment, useState } from 'react'

import { DifficultyEntity } from '.mesh'

interface DifficultyCard {
  difficulty: DifficultyEntity
}

export const DifficultyCard: FC<DifficultyCard> = ({ difficulty }) => {
  const [hover, setHover] = useState(false)

  const {
    attributes: { label, longDescription, slug },
  } = difficulty
  const { color, Icon } = difficultyElements[slug]
  const isTechnicalCard = slug === 'technical'

  return (
    <a
      href={isTechnicalCard ? docsUrl : `/academy/articles?difficulty=${slug}`}
      target={isTechnicalCard ? '_blank' : '_self'}
      rel="noreferrer"
      className="h-[405px] py-[50px] px-[30px] bg-slate-800 rounded-[30px] flex flex-col justify-between hover:ring-1 ring-slate-600 transition duration-300"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <AcademyIcon Icon={Icon} color={color} />

      <div className="space-y-5">
        <div className="relative flex items-center h-10">
          <Chip
            label={label}
            color="default"
            className="h-7 sm:text-sm sm:font-normal pl-[14px] pr-[14px]"
            icon={<CircleIcon width={8} height={8} fill={color} stroke={color} />}
          />
          <Transition
            as={Fragment}
            show={hover}
            enter="ease-in-out duration-300"
            enterFrom="translate-x-[20px] opacity-0"
            enterTo="translate-x-[0px] opacity-100"
            leave="ease-in-out duration-300"
            leaveFrom="translate-x-[0px] opacity-100"
            leaveTo="translate-x-[20px] opacity-0"
            unmount={false}
          >
            <div className="absolute top-0 bottom-0 right-0 flex items-center justify-center">
              <div className="bg-[#3B7EF6] rounded-full p-3">
                <ArrowRightIcon className="w-4 h-4 " />
              </div>
            </div>
          </Transition>
        </div>
        <p className="text-xl font-bold sm:text-2xl">{longDescription}</p>
      </div>
    </a>
  )
}
