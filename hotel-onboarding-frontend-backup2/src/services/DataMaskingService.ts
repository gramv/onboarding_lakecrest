export interface MaskingOptions {
  showLastDigits?: number;
  maskChar?: string;
  preserveFormat?: boolean;
}

export class DataMaskingService {
  private static instance: DataMaskingService;

  private constructor() {}

  public static getInstance(): DataMaskingService {
    if (!DataMaskingService.instance) {
      DataMaskingService.instance = new DataMaskingService();
    }
    return DataMaskingService.instance;
  }

  public maskSSN(ssn: string, options?: MaskingOptions): string {
    if (!ssn) return '';
    const cleanSSN = ssn.replace(/\D/g, '');
    if (cleanSSN.length !== 9) {
      return this.maskGeneric(ssn, { showLastDigits: 4, ...options });
    }
    const maskChar = options?.maskChar || 'X';
    const showLastDigits = options?.showLastDigits ?? 4;
    if (options?.preserveFormat === false) {
      const maskedPart = maskChar.repeat(9 - showLastDigits);
      const visiblePart = cleanSSN.slice(-showLastDigits);
      return maskedPart + visiblePart;
    }
    if (showLastDigits === 4) {
      return `${maskChar}${maskChar}${maskChar}-${maskChar}${maskChar}-${cleanSSN.slice(5)}`;
    }
    const totalMaskLength = 9 - showLastDigits;
    const masked = maskChar.repeat(totalMaskLength) + cleanSSN.slice(-showLastDigits);
    return `${masked.slice(0, 3)}-${masked.slice(3, 5)}-${masked.slice(5)}`;
  }

  public maskAccountNumber(accountNumber: string, options?: MaskingOptions): string {
    if (!accountNumber) return '';
    const maskChar = options?.maskChar || '*';
    const showLastDigits = options?.showLastDigits ?? 4;
    const cleanAccount = accountNumber.replace(/\s/g, '');
    if (cleanAccount.length <= showLastDigits) return cleanAccount;
    const maskedLength = cleanAccount.length - showLastDigits;
    const maskedPart = maskChar.repeat(Math.min(maskedLength, 12));
    const visiblePart = cleanAccount.slice(-showLastDigits);
    return maskedPart + visiblePart;
  }

  public maskRoutingNumber(routingNumber: string, options?: MaskingOptions): string {
    if (!routingNumber) return '';
    const maskChar = options?.maskChar || '*';
    const showLastDigits = options?.showLastDigits ?? 4;
    const cleanRouting = routingNumber.replace(/\D/g, '');
    if (cleanRouting.length !== 9) {
      return this.maskGeneric(routingNumber, { showLastDigits, ...options });
    }
    const maskedLength = 9 - showLastDigits;
    const maskedPart = maskChar.repeat(maskedLength);
    const visiblePart = cleanRouting.slice(-showLastDigits);
    return maskedPart + visiblePart;
  }

  public maskGeneric(data: string, options?: MaskingOptions): string {
    if (!data) return '';
    const maskChar = options?.maskChar || '*';
    const showLastDigits = options?.showLastDigits ?? 4;
    if (data.length <= showLastDigits) return data;
    const maskedLength = data.length - showLastDigits;
    const maskedPart = maskChar.repeat(maskedLength);
    const visiblePart = data.slice(-showLastDigits);
    return maskedPart + visiblePart;
  }

  public maskEmail(email: string, options?: MaskingOptions): string {
    if (!email || !email.includes('@')) return email;
    const [localPart, domain] = email.split('@');
    const maskChar = options?.maskChar || '*';
    if (localPart.length <= 2) return `${maskChar}@${domain}`;
    const firstChar = localPart[0];
    const lastChar = localPart[localPart.length - 1];
    const maskLength = Math.max(1, localPart.length - 2);
    const masked = firstChar + maskChar.repeat(maskLength) + lastChar;
    return `${masked}@${domain}`;
  }

  public maskPhoneNumber(phone: string, options?: MaskingOptions): string {
    if (!phone) return '';
    const cleanPhone = phone.replace(/\D/g, '');
    const maskChar = options?.maskChar || '*';
    if (cleanPhone.length === 10) {
      const areaCode = cleanPhone.slice(0, 3);
      const lastTwo = cleanPhone.slice(-2);
      return `(${areaCode}) ${maskChar}${maskChar}${maskChar}-${maskChar}${maskChar}${lastTwo}`;
    }
    return this.maskGeneric(phone, { showLastDigits: 4, ...options });
  }

  public formatSSN(ssn: string): string {
    const clean = ssn.replace(/\D/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 5) return `${clean.slice(0,3)}-${clean.slice(3)}`;
    return `${clean.slice(0,3)}-${clean.slice(3,5)}-${clean.slice(5,9)}`;
  }

  public formatPhone(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `(${clean.slice(0,3)}) ${clean.slice(3)}`;
    return `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6,10)}`;
  }

  public formatAccountNumber(account: string): string {
    return account.replace(/\s/g, '');
  }
}

export const dataMasking = DataMaskingService.getInstance();

