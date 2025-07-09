import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { DataParser } from '../utils/dataParser';
import { DonorData, FileUploadResult } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: DonorData[]) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<FileUploadResult | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, []);

  const handleFile = async (file: File) => {
    setUploadResult(null);
    
    try {
      const result = await DataParser.parseFile(file);
      setUploadResult(result);
      
      if (result.success && result.data) {
        onDataLoaded(result.data);
      }
    } catch (error) {
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        recordsProcessed: 0
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className="w-12 h-12 text-gray-400" />
          <div>
            <p className="text-lg font-medium text-gray-700">
              {uploadResult?.success ? 'Upload another file' : 'Upload your donor data file'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {uploadResult?.success 
                ? 'New data will be merged with existing records'
                : 'Drag & drop or click to select • CSV format supported'
              }
            </p>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading}
          />
        </div>
      </div>

      {uploadResult && (
        <div className={`mt-4 p-4 rounded-lg border ${
          uploadResult.success 
            ? 'border-green-200 bg-green-50' 
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center space-x-2">
            {uploadResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <div>
              <p className={`font-medium ${
                uploadResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {uploadResult.success ? 'Data merged successfully!' : 'Upload failed'}
              </p>
              {uploadResult.success && (
                <p className="text-sm text-green-600">
                  Added {uploadResult.recordsProcessed} new records to your database
                </p>
              )}
              {uploadResult.error && (
                <p className="text-sm text-red-600">
                  {uploadResult.error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Supported Data Format</p>
            <p className="text-sm text-blue-600 mt-1">
              Your file should contain columns for: First Name, Last Name, Donation Amount, and Date/Month. 
              The system will automatically detect and map these fields, then merge with existing data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};