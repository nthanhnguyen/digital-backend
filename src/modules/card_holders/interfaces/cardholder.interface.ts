export enum CardholderType {
  INDIVIDUAL = 'INDIVIDUAL',
  DELEGATE = 'DELEGATE',
}

export enum CardholderStatus {
  INCOMPLETE = 'INCOMPLETE',
  PENDING = 'PENDING',
  READY = 'READY',
  DISABLED = 'DISABLED',
}

export interface Cardholder {
  id: string;
  userId: string;
  airwallexCardholderId: string;
  type: CardholderType;
  status: CardholderStatus;
  createdAt: Date;
}

export interface AirwallexCreateCardholderRequest {
  email: string;
  type: 'INDIVIDUAL' | 'DELEGATE';
  individual: {
    express_consent_obtained: string;
    name: {
      first_name: string;
      last_name: string;
    };
    date_of_birth: string;
    address: {
      line1: string;
      city: string;
      country: string;
      postcode: string;
    };
  };
}

export interface AirwallexCardholderResponse {
  cardholder_id: string;
  status: string;
  type: string;
  individual: {
    name: {
      first_name: string;
      last_name: string;
    };
    date_of_birth: string;
    address: {
      line1: string;
      city: string;
      country: string;
      postcode: string;
    };
  };
}
