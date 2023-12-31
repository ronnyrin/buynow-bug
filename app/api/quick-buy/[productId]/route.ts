import { NextRequest, NextResponse } from 'next/server';
import { getWixClient } from '@app/hooks/useWixClientServer';
import { checkout as checkoutTypes } from '@wix/ecom';
import { getRequestUrl } from '@app/utils/server-utils';

export async function GET(
  request: NextRequest,
  {
    params: { productId },
  }: {
    params: { productId: string };
  }
) {
  const requestUrl = getRequestUrl(request);
  const baseUrl = new URL('/', requestUrl).toString();
  console.log('in route:', 'baseUrl', baseUrl, 'requestUrl', requestUrl);
  const { searchParams } = new URL(requestUrl);
  const quantity = parseInt(searchParams.get('quantity') || '1', 10);
  const productOptions = JSON.parse(
    searchParams.get('productOptions') || 'null'
  );
  const wixClient = await getWixClient();
  const { product } = await wixClient.products.getProduct(productId);
  if (!product) {
    return new Response('Product not found', {
      status: 404,
    });
  }
  const selectedOptions =
    productOptions ??
    (product.manageVariants
      ? { variantId: product.variants![0]._id }
      : product?.productOptions?.length
      ? {
          options:
            product?.productOptions?.reduce((acc, option) => {
              acc[option.name!] = option.choices![0].description!;
              return acc;
            }, {} as Record<string, any>) ?? {},
        }
      : undefined);
  const item = {
    quantity,
    catalogReference: {
      catalogItemId: product._id!,
      appId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      options: selectedOptions,
    },
  };
  const checkout = await wixClient.ecomCheckout.createCheckout({
    lineItems: [item],
    channelType: checkoutTypes.ChannelType.WEB,
  });

  const { redirectSession } = await wixClient.redirects.createRedirectSession({
    ecomCheckout: { checkoutId: checkout!._id! },
    callbacks: {
      postFlowUrl: baseUrl,
      thankYouPageUrl: `${baseUrl}/stores-success`,
      cartPageUrl: `${baseUrl}/cart`,
    },
  });
  return NextResponse.json({
    redirectSession,
    baseUrl,
    requestUrl,
    header: request.headers.get('x-middleware-request-url'),
  });
}
