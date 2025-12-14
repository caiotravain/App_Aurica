/**
 * CPF (Cadastro de Pessoa Física) validation and formatting utilities
 */

/**
 * Removes all non-numeric characters from CPF string
 */
export const cleanCpf = (cpf: string): string => {
  return cpf.replace(/\D/g, '');
};

/**
 * Formats CPF string to the pattern 000.000.000-00
 */
export const formatCpf = (cpf: string): string => {
  const cleaned = cleanCpf(cpf);
  
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  } else if (cleaned.length <= 9) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  } else {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  }
};

/**
 * Validates CPF using the official algorithm
 * Returns true if CPF is valid, false otherwise
 */
export const validateCpf = (cpf: string): boolean => {
  const cleaned = cleanCpf(cpf);
  
  // CPF must have exactly 11 digits
  if (cleaned.length !== 11) {
    return false;
  }
  
  // Check if all digits are the same (invalid CPF)
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return false;
  }
  
  // Calculate first verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) {
    return false;
  }
  
  // Calculate second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) {
    return false;
  }
  
  return true;
};

/**
 * Validates CPF and returns an error message if invalid
 * Returns empty string if valid
 */
export const getCpfValidationError = (cpf: string): string => {
  if (!cpf || cpf.trim() === '') {
    return ''; // CPF is optional
  }
  
  const cleaned = cleanCpf(cpf);
  
  if (cleaned.length === 0) {
    return ''; // Empty is valid (optional field)
  }
  
  if (cleaned.length !== 11) {
    return 'CPF deve conter 11 dígitos';
  }
  
  if (!validateCpf(cpf)) {
    return 'CPF inválido';
  }
  
  return '';
};

