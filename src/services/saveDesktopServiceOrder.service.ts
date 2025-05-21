import { PrismaClient } from '@prisma/client/storage/client.js';
import { dateTimeFormatterUtil, HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';

const prisma = new PrismaClient();

export const saveDesktopServiceOrder = async () => { 
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.a as string));

  const localDate = dateTimeFormatterUtil.getLocalDate();
  const localDateCurrentDay = localDate.getDate();
  const localDateCurrentMonth = ('0' + localDate.getMonth() + 1).slice(-2);
  const localDateCurrentYear = ('0' + localDate.getFullYear()).slice(-2);

  let localDateLastDay = new Date(localDate.getTime() - (24 * 60 * 60 * 1000));

  localDateLastDay = new Date(localDateLastDay.getTime() - localDateLastDay.getTimezoneOffset() * 60_000);

  const localDateLastMonth = ('0' + localDateLastDay.getMonth() + 1).slice(-2);
  const localDateLastYear = ('0' + localDateLastDay.getFullYear()).slice(-2);

  const responseA: any = (
    (
      await httpClientInstance.get(
        `https://api.segware.com.br/v1/serviceOrders?fromDate=${ localDateLastDay }%2F${ localDateLastMonth }%2F${ localDateLastYear }&toShowDate=${ localDateCurrentDay }%2F${ localDateCurrentMonth }%2F${ localDateCurrentYear }&dateType=CLOSING`
      )
    ) as unknown as any[]
  ).filter((serviceOrder: any) => serviceOrder.status === 4);

  try {
    await Promise.allSettled(
      responseA.data.forEach(
        async (serviceOrder: any): Promise<any> => {
          const userAndContact: any = (
            (
              await httpClientInstance.get(`${ process.env.a }/${ serviceOrder.id }/userAndContacts`)
            ) as any
          ).data.filter((userAndContact: any) => userAndContact.function && userAndContact.function.match(/\bPESQUISA\b/g))[0];

          if (userAndContact) {
            const phone01 = userAndContact.phone01?.replace(/^\+?55\s?/, '').replace(/\D/g, '');

            if (phone01.length === 11) {
              await prisma.neppo_satisfying_surveys.create(
                {
                  data: {
                    service_order_number: serviceOrder.sequentialId,
                    csid: serviceOrder.accountCode,
                    phone: phone01
                  }
                }
              );
            } else {
              const phone02 = userAndContact.phone02?.replace(/^\+?55\s?/, '').replace(/\D/g, '');

              if (phone02.length === 11) {
                await prisma.neppo_satisfying_surveys.create(
                  {
                    data: {
                      service_order_number: serviceOrder.sequentialId,
                      csid: serviceOrder.accountCode,
                      phone: phone02
                    }
                  }
                );
              }
            }
          }
        }
      )
    );
  } catch (error: unknown) {
    console.log(`Service | Timestamp: ${ timestamp } | Name: saveDesktopServiceOrder | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
