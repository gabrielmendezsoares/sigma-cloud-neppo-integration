export const saveCloudServiceOrder = async () => { 
   try {
        const osCloud: any[] = await serviceOrdersCloud()

        for (let i = 0; i < osCloud.length; i++) {
            
            let contato = await userAndContactsCloud(osCloud[i].accountId)
            if (contato){
                
                // let phoneCleaned = contato.phone01.replace(/\D/g, '');
                let phoneCleaned = contato.phone01.replace(/^\+?55\s?/, '').replace(/\D/g, '')
                // console.log('a',contato.phone01,'b', phoneCleaned);

                // Garante que o número de telefone tenha exatamente 11 dígitos
                if (phoneCleaned.length === 11) {
                    criarAvaliacao({
                        nomeroOS: osCloud[i].sequentialId.toString(),
                        nomeUsuario: contato.name.toString(),
                        telefoneUsuario: phoneCleaned.toString(),
                        csid: osCloud[i].accountCode.toString() 
                    });
                    
                    console.log( `
                        OS armazenada com sucesso!
                        Dados da OS:
                        nomeroOS - ${osCloud[i].sequentialId.toString()},
                        nomeUsuario - ${contato.name.toString()},
                        telefoneUsuario - ${phoneCleaned.toString()},
                        csid - ${osCloud[i].accountCode.toString()} 

                        Data e hora: ${formatAsDayMonthYear(new Date)} - ${formatAsHoursMinutesSeconds(new Date)}
                    `);
                } else {
                    logger.info({
                        message: 'Numero de telefone invalido',
                        Contato: contato
                    });
                }
            }   
        }
   } catch (error) {
        logger.error({
            message: 'Erro salvarOSCloud',
            error: error
        });
   }
}