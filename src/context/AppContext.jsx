import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { ProductionProvider } from './ProductionContext';
import { IncomeProvider } from './IncomeContext';
import { SalaryProvider } from './SalaryContext';

export function AppProvider({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ProductionProvider>
          <IncomeProvider>
            <SalaryProvider>
              {children}
            </SalaryProvider>
          </IncomeProvider>
        </ProductionProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
