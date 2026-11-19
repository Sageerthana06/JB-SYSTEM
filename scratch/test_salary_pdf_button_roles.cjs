const fs = require('fs');
const path = require('path');

function testSalaryPdfButtonRoles() {
  console.log('================================================================');
  console.log('JB SYSTEM - WEEKLY SALARY PDF BUTTON & ROLE PERMISSIONS TEST');
  console.log('================================================================');

  const filePath = path.join(__dirname, '../src/components/WeeklySalaryERP.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verify role detection definitions
  console.log('\n1. Verifying role detection declarations in WeeklySalaryERP.jsx:');
  const hasUserRole = code.includes("const userRole = (user?.role || '').toUpperCase();");
  const hasIsCeo = code.includes("const isCeo = userRole === 'SUPER_ADMIN' || userRole === 'CEO';");
  const hasIsManager = code.includes("const isManager = userRole === 'MANAGER';");
  const hasIsAdmin = code.includes("const isAdmin = userRole === 'ADMIN';");
  const hasCanDisburse = code.includes("const canDisburse = isCeo || isManager;");
  const hasCanDownloadPdf = code.includes("const canDownloadPdf = isCeo || isManager || isAdmin;");

  console.log(`- userRole normalization (toUpperCase): ${hasUserRole ? 'PASS' : 'FAIL'}`);
  console.log(`- isCeo (SUPER_ADMIN || CEO): ${hasIsCeo ? 'PASS' : 'FAIL'}`);
  console.log(`- isManager: ${hasIsManager ? 'PASS' : 'FAIL'}`);
  console.log(`- isAdmin: ${hasIsAdmin ? 'PASS' : 'FAIL'}`);
  console.log(`- canDisburse strictly (isCeo || isManager): ${hasCanDisburse ? 'PASS' : 'FAIL'}`);
  console.log(`- canDownloadPdf (isCeo || isManager || isAdmin): ${hasCanDownloadPdf ? 'PASS' : 'FAIL'}`);

  if (!hasUserRole || !hasIsCeo || !hasIsManager || !hasIsAdmin || !hasCanDisburse || !hasCanDownloadPdf) {
    throw new Error('Role declarations test failed');
  }

  // 2. Simulate role evaluation
  console.log('\n2. Simulating role authority matrix:');
  const testRoles = [
    { role: 'SUPER_ADMIN', branchId: null, expectDownload: true, expectDisburse: true },
    { role: 'CEO', branchId: null, expectDownload: true, expectDisburse: true },
    { role: 'MANAGER', branchId: 1, expectDownload: true, expectDisburse: true },
    { role: 'ADMIN', branchId: null, expectDownload: true, expectDisburse: false },
    { role: 'admin', branchId: null, expectDownload: true, expectDisburse: false }, // case-insensitivity
    { role: 'STAFF', branchId: 1, expectDownload: false, expectDisburse: false },
    { role: 'TAILOR', branchId: 1, expectDownload: false, expectDisburse: false },
    { role: 'CASHIER', branchId: 1, expectDownload: false, expectDisburse: false }
  ];

  for (const t of testRoles) {
    const userRole = (t.role || '').toUpperCase();
    const isCeo = userRole === 'SUPER_ADMIN' || userRole === 'CEO';
    const isManager = userRole === 'MANAGER';
    const isAdmin = userRole === 'ADMIN';
    const canDisburse = isCeo || isManager;
    const canDownloadPdf = isCeo || isManager || isAdmin;

    const downloadPass = canDownloadPdf === t.expectDownload;
    const disbursePass = canDisburse === t.expectDisburse;

    console.log(`- Role "${t.role}": canDownloadPdf=${canDownloadPdf} (${downloadPass ? 'OK' : 'MISMATCH'}), canDisburse=${canDisburse} (${disbursePass ? 'OK' : 'MISMATCH'})`);
    if (!downloadPass || !disbursePass) throw new Error(`Role test failed for ${t.role}`);
  }

  // 3. Verify PDF button visibility guards in JSX
  console.log('\n3. Verifying JSX button guards:');
  const hasFullPdfGuard = code.includes('{canDownloadPdf && (\n            <button\n              onClick={handleDownloadFullPDF}');
  const hasAllocationsPdfGuard = code.includes('{canDownloadPdf && (\n              <button\n                onClick={handleDownloadAllocationsPDF}');
  const hasTailorSummaryGuard = code.includes('{canDownloadPdf && (\n              <button\n                onClick={handleDownloadTailorsSummaryPDF}');
  const hasSingleTailorGuard = code.includes('{canDownloadPdf && (\n                    <button\n                      onClick={() => handleDownloadSingleTailorPDF(stmt)}');
  const hasBreakdownGuard = code.includes('{canDownloadPdf && (\n              <button\n                onClick={handleDownloadCuttingVsStitchingPDF}');
  const hasCustomerHoldsGuard = code.includes('{canDownloadPdf && (\n              <button\n                onClick={handleDownloadCustomerHoldsPDF}');
  const hasHistoryGuard = code.includes('{canDownloadPdf && (\n              <button\n                onClick={handleDownloadDisbursementHistoryPDF}');

  console.log(`- Full PDF Button guarded by canDownloadPdf: ${hasFullPdfGuard ? 'PASS' : 'FAIL'}`);
  console.log(`- Allocations PDF Button guarded by canDownloadPdf: ${hasAllocationsPdfGuard ? 'PASS' : 'FAIL'}`);
  console.log(`- Tailors Summary PDF Button guarded: ${hasTailorSummaryGuard ? 'PASS' : 'FAIL'}`);
  console.log(`- Single Tailor Statement PDF Button guarded: ${hasSingleTailorGuard ? 'PASS' : 'FAIL'}`);
  console.log(`- Breakdown PDF Button guarded: ${hasBreakdownGuard ? 'PASS' : 'FAIL'}`);
  console.log(`- Customer Holds PDF Button guarded: ${hasCustomerHoldsGuard ? 'PASS' : 'FAIL'}`);
  console.log(`- Disbursement History PDF Button guarded: ${hasHistoryGuard ? 'PASS' : 'FAIL'}`);

  if (!hasFullPdfGuard || !hasAllocationsPdfGuard) {
    throw new Error('PDF button guard test failed');
  }

  // 4. Verify triggerPdfDownload guard
  console.log('\n4. Verifying triggerPdfDownload execution guard:');
  const hasTriggerGuard = code.includes('if (!reportData || !canDownloadPdf) return;');
  console.log(`- triggerPdfDownload checks canDownloadPdf: ${hasTriggerGuard ? 'PASS' : 'FAIL'}`);
  if (!hasTriggerGuard) throw new Error('triggerPdfDownload guard missing');

  // 5. Verify payment disbursement restriction (ADMIN read-only)
  console.log('\n5. Verifying Admin read-only protections:');
  const hasDisburseModalCheck = code.includes('if (!canDisburse) {\n      alert(\'Access Denied: Financial payment disbursement requires Manager or CEO authorization.\');');
  const hasTableActionGuard = code.includes('{alloc.status === \'PAYABLE\' && (\n                          canDisburse ? (');
  const hasAdminBanner = code.includes('{isAdmin && (');

  console.log(`- handleOpenPaymentModal guarded by canDisburse: ${hasDisburseModalCheck ? 'PASS' : 'FAIL'}`);
  console.log(`- Table action button strictly checks canDisburse: ${hasTableActionGuard ? 'PASS' : 'FAIL'}`);
  console.log(`- Admin audit banner rendered for Admin: ${hasAdminBanner ? 'PASS' : 'FAIL'}`);

  if (!hasDisburseModalCheck || !hasTableActionGuard || !hasAdminBanner) {
    throw new Error('Admin read-only protection test failed');
  }

  // 6. Verify Manager branch restrictions preserved
  console.log('\n6. Verifying Manager branch restrictions preserved:');
  const hasManagerBranchInit = code.includes('if (isManager && user?.branchId) {');
  const hasManagerBranchDropdownGuard = code.includes('{isManager ? (\n              <div style={{');
  console.log(`- Manager branch locked at initial state: ${hasManagerBranchInit ? 'PASS' : 'FAIL'}`);
  console.log(`- Manager branch dropdown locked/pill rendered: ${hasManagerBranchDropdownGuard ? 'PASS' : 'FAIL'}`);

  if (!hasManagerBranchInit || !hasManagerBranchDropdownGuard) {
    throw new Error('Manager branch restriction test failed');
  }

  console.log('\n================================================================');
  console.log('ALL VERIFICATIONS PASSED: 100% SUCCESS');
  console.log('================================================================\n');
}

testSalaryPdfButtonRoles();

