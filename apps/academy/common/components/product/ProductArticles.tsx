import { Button, Link, Typography } from '@sushiswap/ui'
import { FC } from 'react'

import { ArticleList } from '../ArticleList'
import { Card } from '../Card'
import { ArticleEntity } from '.mesh'

interface ProductArticles {
  title: string
  productName: string
  articles: ArticleEntity[]
  subtitle: string
  isLoading: boolean
}

export const ProductArticles: FC<ProductArticles> = ({ title, productName, articles, subtitle, isLoading }) => {
  return (
    <section className="py-[75px]">
      <div className="flex items-center justify-between w-full">
        <div>
          <Typography weight={700} variant="h1">
            {title}
          </Typography>
          <Typography variant="lg" className="mt-3 text-gray-500">
            {subtitle}
          </Typography>
        </div>
        <Link.Internal href={`/articles?product=${productName}`}>
          <Button variant="outlined" className="min-w-max h-[38px] px-5 !font-medium">
            View All
          </Button>
        </Link.Internal>
      </div>
      <div className="mt-20">
        {articles && (
          <div className="grid grid-cols-1 gap-4 transition-all sm:grid-cols-2 md:grid-cols-3">
            <ArticleList
              skeletonAmount={3}
              articles={articles as unknown as ArticleEntity[]}
              loading={isLoading}
              render={(article) => <Card article={article} key={`article__left__${article?.attributes?.slug}`} />}
            />
          </div>
        )}
      </div>
    </section>
  )
}
