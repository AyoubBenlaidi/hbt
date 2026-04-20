import * as XLSX from 'xlsx';

export interface ExportExpenseRow {
  date: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  beneficiaries: string;
  splitMode: string;
  household: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate a clean filename for the expense export
 * Format: hbt-expenses-{household-slug}-{yyyy-mm-dd}.xlsx
 */
function generateFileName(householdName: string): string {
  const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
  const slug = householdName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/[^a-z0-9\-]/g, '') // remove unsafe characters
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

  return `hbt-expenses-${slug}-${today}.xlsx`;
}

/**
 * Build export rows from raw expense data
 * Handles missing payers, beneficiaries, and notes gracefully
 */
function buildExpenseExportRows(
  expenses: any[],
  householdName: string
): ExportExpenseRow[] {
  return expenses.map((expense) => {
    // Extract payer names safely from users table
    const payers = expense.expense_payers || [];
    const paidByNames = payers
      .map((p: any) => {
        const member = p.household_members;
        const user = member?.users;
        return user?.display_name || member?.user_id || 'Unknown';
      })
      .filter(Boolean)
      .join(', ') || 'Unknown';

    // Extract beneficiary names (from splits) safely from users table
    const beneficiaries = expense.expense_splits || [];
    const beneficiaryNames = beneficiaries
      .map((s: any) => {
        const member = s.household_members;
        const user = member?.users;
        return user?.display_name || member?.user_id || 'Unknown';
      })
      .filter(Boolean)
      .join(', ') || '';

    // Determine split mode based on splits data
    let splitMode = 'Single';
    if (beneficiaries.length > 0) {
      // Check if all split amounts are equal
      const splitAmounts = beneficiaries.map((s: any) => parseFloat(s.amount) || 0);
      const firstAmount = splitAmounts[0];
      const allEqual = splitAmounts.every(
        (amount: number) => Math.abs(amount - firstAmount) < 0.01 // Allow for floating point rounding
      );
      splitMode = allEqual ? 'Equal' : 'Custom amount';
    }

    // Parse dates safely
    const expenseDate = expense.expense_date ? new Date(expense.expense_date).toISOString().split('T')[0] : '';
    const createdAt = expense.created_at ? new Date(expense.created_at).toISOString() : '';
    const updatedAt = expense.updated_at ? new Date(expense.updated_at).toISOString() : '';

    return {
      date: expenseDate,
      description: expense.description || '',
      amount: parseFloat(expense.amount) || 0,
      currency: expense.currency || 'EUR',
      paidBy: paidByNames,
      beneficiaries: beneficiaryNames,
      splitMode,
      household: householdName,
      notes: expense.notes || '',
      createdAt,
      updatedAt,
    };
  });
}

/**
 * Create an Excel workbook with proper formatting
 */
function createExpensesWorkbook(rows: ExportExpenseRow[], householdName: string): XLSX.WorkBook {
  const ws_name = 'Expenses';

  // Create worksheet data with headers
  const headers = [
    'Date',
    'Description',
    'Amount',
    'Currency',
    'Paid By',
    'Beneficiaries',
    'Split Mode',
    'Household',
    'Notes',
    'Created At',
    'Updated At',
  ];

  const wsData = [headers, ...rows.map((row) => [
    row.date,
    row.description,
    row.amount,
    row.currency,
    row.paidBy,
    row.beneficiaries,
    row.splitMode,
    row.household,
    row.notes,
    row.createdAt,
    row.updatedAt,
  ])];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Apply formatting
  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 25 }, // Description
    { wch: 12 }, // Amount
    { wch: 10 }, // Currency
    { wch: 20 }, // Paid By
    { wch: 30 }, // Beneficiaries
    { wch: 15 }, // Split Mode
    { wch: 20 }, // Household
    { wch: 30 }, // Notes
    { wch: 20 }, // Created At
    { wch: 20 }, // Updated At
  ];
  ws['!cols'] = colWidths;

  // Freeze the first row (headers)
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Format header row (bold)
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].font = { bold: true };
    ws[cellRef].fill = { fgColor: { rgb: 'F5F5F5' } };
  }

  // Format amount column as number
  const amountColIndex = 2; // Amount is the 3rd column (0-indexed)
  for (let rowIndex = 1; rowIndex <= rows.length; rowIndex++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: amountColIndex });
    if (ws[cellRef]) {
      ws[cellRef].num_fmt = '0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, ws_name);

  return wb;
}

/**
 * Trigger file download in the browser
 */
function downloadExpensesWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
  XLSX.writeFile(workbook, fileName);
}

/**
 * Main export function
 * Call this from React components to export expenses to XLSX
 */
export async function exportHouseholdExpensesToXlsx(
  expenses: any[],
  householdName: string
): Promise<void> {
  try {
    // Build export rows
    const exportRows = buildExpenseExportRows(expenses, householdName);

    // Create workbook
    const workbook = createExpensesWorkbook(exportRows, householdName);

    // Generate filename
    const fileName = generateFileName(householdName);

    // Trigger download
    downloadExpensesWorkbook(workbook, fileName);
  } catch (error) {
    console.error('Error exporting expenses to XLSX:', error);
    throw error;
  }
}
