import { PrismaClient } from '@prisma/client/storage/client.js';
import { dateTimeFormatterUtil, HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { IServiceOrderCloud, IUserAndContact } from '../interfaces/index.js';

const prisma = new PrismaClient();

export const createCloudSatisfactionSurvey = async () => { 
  const localDate = dateTimeFormatterUtil.getLocalDate();
  const localDateCurrentDay = localDate.getDate();
  const localDateCurrentMonth = String(localDate.getMonth() + 1).padStart(2, '0');
  const localDateCurrentYear = String(localDate.getFullYear()).padStart(2, '0');

  let localDateLastDay = new Date(localDate.getTime() - (7 * 24 * 60 * 60 * 1_000));

  localDateLastDay = new Date(localDateLastDay.getTime() - localDateLastDay.getTimezoneOffset() * 60_000);

  const localDateLastMonth = String(localDateLastDay.getMonth() + 1).padStart(2, '0');
  const localDateLastYear = String(localDateLastDay.getFullYear()).padStart(2, '0');

  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.SIGMA_CLOUD_BEARER_TOKEN as string));

  try {
    const serviceOrderList = await httpClientInstance.get<IServiceOrderCloud.IServiceOrderCloud[]>(`https://api.segware.com.br/v1/serviceOrders?fromDate=${ localDateLastDay }%2F${ localDateLastMonth }%2F${ localDateLastYear }&toShowDate=${ localDateCurrentDay }%2F${ localDateCurrentMonth }%2F${ localDateCurrentYear }&dateType=CLOSING`);
    const serviceOrderFilteredList = serviceOrderList.data.filter((serviceOrder: IServiceOrderCloud.IServiceOrderCloud): boolean => serviceOrder.status === 4);

    await Promise.allSettled(
      serviceOrderFilteredList.map(
        async (serviceOrder: IServiceOrderCloud.IServiceOrderCloud): Promise<any> => {
          const userAndContactList = await httpClientInstance.get<IUserAndContact.IUserAndContact[]>(`https://api.segware.com.br/v1/accounts/${ serviceOrder.id }/userAndContacts`);
          const userAndContactFilteredList = userAndContactList.data.filter((userAndContact: IUserAndContact.IUserAndContact): boolean => !!(userAndContact.function && userAndContact.function.match(/\bPESQUISA\b/g)));

          userAndContactFilteredList.every(
            async (userAndContact: IUserAndContact.IUserAndContact): Promise<boolean> => {
              const phone01 = userAndContact.phone01
                ? parseInt(`55${ userAndContact.phone01.replace(/\D/g, '').slice(-11) }`, 10)
                : undefined;

              if (phone01) {
                await prisma.neppo_satisfaction_surveys.create(
                  {
                    data: {
                      service_order_number: serviceOrder.sequentialId,
                      csid: serviceOrder.accountCode,
                      phone: phone01,
                      status: 'pending'
                    }
                  }
                );

                return false;
              }

              return true;
            }
          );
        }
      )
    );
  } catch (error: unknown) {
    console.log(`Service | Timestamp: ${ dateTimeFormatterUtil.getLocalDate() } | Name: createCloudSatisfactionSurvey | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
