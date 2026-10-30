export interface IcreateCompanyProfile {
  
    name: string;
    email: string;
    password:string;

    company: {
    name: string;
    website?: string;
    industry?: string;
    description?: string;
    logoUrl?: string;
  };
  };
  




export interface IUpdateCompanyProfile {
 
    name?: string;
    website?: string;
    industry?: string;
    description?: string;
    logoUrl?: string | null;
  
}


export interface IApproveCompany {
    companyId: string;
    isApproved:boolean ;
}


export interface IVerifyCompanyEmailPayload {
    email: string;
    otp: string;
}
