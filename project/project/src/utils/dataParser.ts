import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DonorData, Donation, FileUploadResult } from '../types';
import { formatDate, parseDate } from './dateUtils';
import { generateId } from './helpers';

interface RawDataRow {
  [key: string]: string | number;
}

export class DataParser {
  private static readonly COMMON_FIELD_MAPPINGS = {
    firstName: ['first_name', 'firstname', 'fname', 'first', 'given_name'],
    lastName: ['last_name', 'lastname', 'lname', 'last', 'surname', 'family_name'],
    amount: ['amount', 'donation', 'gift', 'contribution', 'value', 'total'],
    date: ['date', 'donation_date', 'gift_date', 'received_date', 'timestamp'],
    month: ['month', 'donation_month', 'gift_month'],
    email: ['email', 'email_address', 'e_mail'],
    phone: ['phone', 'phone_number', 'telephone', 'mobile']
  };

  static async parseFile(file: File): Promise<FileUploadResult> {
    try {
      const fileType = this.getFileType(file);
      let rawData: RawDataRow[] = [];

      switch (fileType) {
        case 'csv':
          rawData = await this.parseCSV(file);
          break;
        case 'excel':
          rawData = await this.parseExcel(file);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      const processedData = this.processRawData(rawData);
      const donorData = this.groupByDonor(processedData);

      return {
        success: true,
        data: donorData,
        recordsProcessed: rawData.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        recordsProcessed: 0
      };
    }
  }

  private static getFileType(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') return 'csv';
    if (extension === 'xlsx' || extension === 'xls') return 'excel';
    
    throw new Error('Unsupported file format');
  }

  private static parseCSV(file: File): Promise<RawDataRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          } else {
            resolve(results.data as RawDataRow[]);
          }
        },
        error: (error) => reject(error)
      });
    });
  }

  private static async parseExcel(file: File): Promise<RawDataRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as RawDataRow[];
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsBinaryString(file);
    });
  }

  private static processRawData(rawData: RawDataRow[]): Donation[] {
    return rawData.map(row => {
      const mappedRow = this.mapFields(row);
      return {
        id: generateId(),
        firstName: String(mappedRow.firstName || '').trim(),
        lastName: String(mappedRow.lastName || '').trim(),
        amount: this.parseAmount(mappedRow.amount),
        date: this.parseDate(mappedRow.date, mappedRow.month),
        month: this.extractMonth(mappedRow.date, mappedRow.month),
        year: this.extractYear(mappedRow.date),
        email: mappedRow.email ? String(mappedRow.email).trim() : undefined,
        phone: mappedRow.phone ? String(mappedRow.phone).trim() : undefined,
        donorId: '' // Will be set during grouping
      };
    }).filter(donation => 
      donation.firstName && 
      donation.lastName && 
      donation.amount > 0 && 
      donation.date
    );
  }

  private static mapFields(row: RawDataRow): any {
    const mapped: any = {};
    const normalizedRow: { [key: string]: any } = {};
    
    // Normalize keys
    Object.keys(row).forEach(key => {
      normalizedRow[key.toLowerCase().replace(/\s+/g, '_')] = row[key];
    });

    // Map fields based on common patterns
    Object.entries(this.COMMON_FIELD_MAPPINGS).forEach(([fieldName, patterns]) => {
      for (const pattern of patterns) {
        if (normalizedRow[pattern] !== undefined) {
          mapped[fieldName] = normalizedRow[pattern];
          break;
        }
      }
    });

    return mapped;
  }

  private static parseAmount(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private static parseDate(dateValue: any, monthValue?: any): Date {
    if (dateValue) {
      const parsed = parseDate(String(dateValue));
      if (parsed) return parsed;
    }
    
    if (monthValue) {
      const month = this.parseMonth(monthValue);
      if (month) {
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, month - 1, 1);
      }
    }
    
    return new Date();
  }

  private static parseMonth(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      const normalized = value.toLowerCase();
      const monthIndex = monthNames.findIndex(month => month.startsWith(normalized));
      return monthIndex !== -1 ? monthIndex + 1 : null;
    }
    return null;
  }

  private static extractMonth(dateValue: any, monthValue?: any): string {
    const date = this.parseDate(dateValue, monthValue);
    return formatDate(date, 'MMMM yyyy');
  }

  private static extractYear(dateValue: any): number {
    const date = this.parseDate(dateValue);
    return date.getFullYear();
  }

  private static groupByDonor(donations: Donation[]): DonorData[] {
    const donorMap = new Map<string, DonorData>();

    donations.forEach(donation => {
      const key = `${donation.firstName.toLowerCase()}_${donation.lastName.toLowerCase()}`;
      
      if (!donorMap.has(key)) {
        const donorId = generateId();
        donorMap.set(key, {
          id: donorId,
          firstName: donation.firstName,
          lastName: donation.lastName,
          email: donation.email,
          phone: donation.phone,
          donations: [],
          totalAmount: 0,
          donationCount: 0,
          averageDonation: 0,
          firstDonation: donation.date,
          lastDonation: donation.date,
          donationFrequency: 'one-time'
        });
      }

      const donor = donorMap.get(key)!;
      donation.donorId = donor.id;
      donor.donations.push(donation);
      donor.totalAmount += donation.amount;
      donor.donationCount++;
      
      if (donation.date < donor.firstDonation) {
        donor.firstDonation = donation.date;
      }
      if (donation.date > donor.lastDonation) {
        donor.lastDonation = donation.date;
      }
    });

    // Calculate derived fields
    donorMap.forEach(donor => {
      donor.averageDonation = donor.totalAmount / donor.donationCount;
      donor.donationFrequency = this.calculateDonationFrequency(donor.donationCount);
    });

    return Array.from(donorMap.values());
  }

  private static calculateDonationFrequency(count: number): DonorData['donationFrequency'] {
    if (count === 1) return 'one-time';
    if (count <= 3) return 'occasional';
    if (count <= 6) return 'regular';
    return 'frequent';
  }
}