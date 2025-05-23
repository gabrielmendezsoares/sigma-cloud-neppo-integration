import { PrismaClient } from '@prisma/client/storage/client.js';
import { dateTimeFormatterUtil, HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { ISatisfactionSurvey, IServiceOrderCloud, IUserAndContact } from './interfaces/index.js';

const prisma = new PrismaClient();

export const createCloudSatisfactionSurvey = async () => { 
  const localDateCurrentDate = dateTimeFormatterUtil.getLocalDate();
  const localDateCurrentDay = localDateCurrentDate.getDate();
  const localDateCurrentMonth = String(localDateCurrentDate.getMonth() + 1).padStart(2, '0');
  const localDateCurrentYear = String(localDateCurrentDate.getFullYear()).padStart(2, '0');

  let localDateLastDate = new Date(localDateCurrentDate.getTime() - (7 * 24 * 60 * 60 * 1_000));

  localDateLastDate = new Date(localDateLastDate.getTime() - localDateLastDate.getTimezoneOffset() * 60_000);

  const localDateLastDay = String(localDateLastDate.getDate()).padStart(2, '0');
  const localDateLastMonth = String(localDateLastDate.getMonth() + 1).padStart(2, '0');
  const localDateLastYear = String(localDateLastDate.getFullYear()).padStart(2, '0');

  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.SIGMA_CLOUD_BEARER_TOKEN as string));

  try {
    const satisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany();
    const serviceOrderList = await httpClientInstance.get<IServiceOrderCloud.IServiceOrderCloud[]>(`https://api.segware.com.br/v1/serviceOrders?fromDate=${ localDateLastDay }%2F${ localDateLastMonth }%2F${ localDateLastYear }&toShowDate=${ localDateCurrentDay }%2F${ localDateCurrentMonth }%2F${ localDateCurrentYear }&dateType=CLOSING`);
    const serviceOrderFilteredList = serviceOrderList.data.filter((serviceOrder: IServiceOrderCloud.IServiceOrderCloud): boolean => !!(serviceOrder.status === 4 && !satisfactionSurveyList.map((satisfactionSurvey: ISatisfactionSurvey.ISatisfactionSurvey): string => satisfactionSurvey.service_order_number).includes(String(serviceOrder.sequentialId))));

    await Promise.allSettled(
      serviceOrderFilteredList.map(
        async (serviceOrder: IServiceOrderCloud.IServiceOrderCloud): Promise<any> => {
          const userAndContactList = await httpClientInstance.get<IUserAndContact.IUserAndContact[]>(`https://api.segware.com.br/v1/accounts/${ serviceOrder.accountId }/userAndContacts`);
          const userAndContactFilteredList = userAndContactList.data.filter((userAndContact: IUserAndContact.IUserAndContact): boolean => !!(userAndContact.function && userAndContact.function.name.match(/\bPESQUISA\b/g)));

          for (let index = 0; index < userAndContactFilteredList.length; index += 1) {
            const phone01 = userAndContactFilteredList[index].phone01
              ? `55${ userAndContactFilteredList[index].phone01.replace(/\D/g, '').slice(-11) }`
              : undefined;

            if (phone01 && phone01.length === 13) {                
              await prisma.neppo_satisfaction_surveys.create(
                {
                  data: {
                    service_order_number: String(serviceOrder.sequentialId),
                    csid: serviceOrder.accountCode,
                    phone: phone01,
                    status: 'pending'
                  }
                }
              );

              break;
            }
          }
        }
      )
    );
  } catch (error: unknown) {
    console.log(`Service | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Name: createCloudSatisfactionSurvey | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
