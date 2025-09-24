import React, { useState, useCallback, useEffect, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { dataMasking } from '@/services/DataMaskingService';
import { cn } from '@/lib/utils';

export type MaskType = 'ssn' | 'account' | 'routing' | 'phone' | 'email' | 'generic';

export interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  maskType: MaskType;
  value: string;
  onChange: (value: string) => void;
  onMaskedValueChange?: (maskedValue: string) => void;
  showToggle?: boolean;
  autoMaskOnBlur?: boolean;
  unmaskOnFocus?: boolean;
  maskOptions?: {
    showLastDigits?: number;
    maskChar?: string;
    preserveFormat?: boolean;
  };
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  inputClassName?: string;
  required?: boolean;
}

const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(({
  maskType,
  value,
  onChange,
  onMaskedValueChange,
  showToggle = true,
  autoMaskOnBlur = true,
  unmaskOnFocus = false,
  maskOptions,
  label,
  error,
  helperText,
  containerClassName,
  inputClassName,
  required = false,
  disabled = false,
  placeholder,
  ...rest
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  const getMaskFunction = useCallback(() => {
    switch (maskType) {
      case 'ssn':
        return (val: string) => dataMasking.maskSSN(val, maskOptions);
      case 'account':
        return (val: string) => dataMasking.maskAccountNumber(val, maskOptions);
      case 'routing':
        return (val: string) => dataMasking.maskRoutingNumber(val, maskOptions);
      case 'phone':
        return (val: string) => dataMasking.maskPhoneNumber(val, maskOptions);
      case 'email':
        return (val: string) => dataMasking.maskEmail(val, maskOptions);
      case 'generic':
      default:
        return (val: string) => dataMasking.maskGeneric(val, maskOptions);
    }
  }, [maskType, maskOptions]);

  const getFormatFunction = useCallback(() => {
    switch (maskType) {
      case 'ssn':
        return dataMasking.formatSSN;
      case 'phone':
        return dataMasking.formatPhone;
      case 'account':
        return dataMasking.formatAccountNumber;
      default:
        return (val: string) => val;
    }
  }, [maskType]);

  useEffect(() => {
    const maskFn = getMaskFunction();
    const formatFn = getFormatFunction();

    if (isVisible || isFocused) {
      setDisplayValue(formatFn(value));
    } else {
      const masked = maskFn(value);
      setDisplayValue(masked);
      onMaskedValueChange?.(masked);
    }
  }, [value, isVisible, isFocused, getMaskFunction, getFormatFunction, onMaskedValueChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    let cleanValue = newValue;
    if (maskType === 'ssn' || maskType === 'phone') {
      cleanValue = newValue.replace(/\D/g, '');
    }
    onChange(cleanValue);
  }, [onChange, maskType]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (unmaskOnFocus && !isVisible) setIsVisible(true);
    rest.onFocus?.(e);
  }, [unmaskOnFocus, isVisible, rest]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (autoMaskOnBlur && isVisible && unmaskOnFocus) setIsVisible(false);
    rest.onBlur?.(e);
  }, [autoMaskOnBlur, isVisible, unmaskOnFocus, rest]);

  const toggleVisibility = useCallback(() => {
    if (!disabled) setIsVisible(prev => !prev);
  }, [disabled]);

  const getInputType = () => {
    if (maskType === 'email') return 'email';
    if (maskType === 'phone') return 'tel';
    return 'text';
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    switch (maskType) {
      case 'ssn': return 'XXX-XX-XXXX';
      case 'phone': return '(XXX) XXX-XXXX';
      case 'account': return 'Account Number';
      case 'routing': return 'Routing Number';
      case 'email': return 'email@example.com';
      default: return '';
    }
  };

  return (
    <div className={cn('space-y-1', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={ref}
          type={getInputType()}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={getPlaceholder()}
          className={cn(
            'w-full px-3 py-2 border rounded-md shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            error ? 'border-red-500' : 'border-gray-300',
            showToggle && 'pr-16',
            inputClassName
          )}
          {...rest}
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
          {showToggle && value && (
            <button
              type="button"
              onClick={toggleVisibility}
              disabled={disabled}
              className={cn(
                'p-1 rounded hover:bg-gray-100 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label={isVisible ? 'Hide value' : 'Show value'}
            >
              {isVisible ? (
                <EyeOff className="h-4 w-4 text-gray-500" />
              ) : (
                <Eye className="h-4 w-4 text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
    </div>
  );
});

MaskedInput.displayName = 'MaskedInput';

export default MaskedInput;

export const SSNInput = forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'maskType'>>((props, ref) => (
  <MaskedInput ref={ref} maskType="ssn" label="Social Security Number" placeholder="XXX-XX-XXXX" helperText="Your SSN is encrypted and secure" {...props} />
));
SSNInput.displayName = 'SSNInput';

export const AccountNumberInput = forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'maskType'>>((props, ref) => (
  <MaskedInput ref={ref} maskType="account" label="Account Number" helperText="Your account number is encrypted" {...props} />
));
AccountNumberInput.displayName = 'AccountNumberInput';

export const RoutingNumberInput = forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'maskType'>>((props, ref) => (
  <MaskedInput ref={ref} maskType="routing" label="Routing Number" helperText="9-digit routing number" {...props} />
));
RoutingNumberInput.displayName = 'RoutingNumberInput';

export const PhoneInput = forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'maskType'>>((props, ref) => (
  <MaskedInput ref={ref} maskType="phone" label="Phone Number" placeholder="(XXX) XXX-XXXX" {...props} />
));
PhoneInput.displayName = 'PhoneInput';

export const EmailInput = forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'maskType'>>((props, ref) => (
  <MaskedInput ref={ref} maskType="email" label="Email Address" placeholder="email@example.com" showToggle={false} {...props} />
));
EmailInput.displayName = 'EmailInput';

