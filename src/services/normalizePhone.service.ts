export const normalizePhone = (phone: string): string | null => {
  let cleanPhone = phone.replace(/\D/g, '');

  if (cleanPhone.startsWith('55')) {
    cleanPhone = cleanPhone.slice(2);
  }

  while (cleanPhone.length >= 10) {
    const areaCode = cleanPhone.slice(0, 2);
    const areaCodeInt = parseInt(areaCode);

    if (!isNaN(areaCodeInt) && areaCodeInt >= 11 && areaCodeInt <= 99) {
      break;
    }

    cleanPhone = cleanPhone.slice(1);
  }

  if (cleanPhone.length < 10) {
    return null;
  }

  cleanPhone = cleanPhone.slice(-11);

  if (cleanPhone.length === 11) {
    return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(3);
  }

  return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2);
};
