export const normalizePhone = (phone: string): string | null => {
  let cleanPhone = phone.startsWith('55') 
    ? phone.slice(2).slice(-11) 
    : phone.slice(-11);

  const areaCode = cleanPhone.slice(0, 2);

  let areaCodeInt = parseInt(areaCode);
  
  if (areaCodeInt < 11 && areaCodeInt > 99) {
    areaCodeInt = parseInt(cleanPhone.slice(1, 3));

    if (areaCodeInt < 11 && areaCodeInt > 99) {
      return null;
    } else {
      cleanPhone = cleanPhone.slice(1);
    }
  }

  switch (cleanPhone.length) {
    case 11:
      return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(3);

    case 10:
      return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2);

    default:
      return null;
  }
};
