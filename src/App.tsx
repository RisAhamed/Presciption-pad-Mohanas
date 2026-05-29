import { useEffect, useRef } from 'react';
import './App.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const html2pdf: any;

function App() {
    const billRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Set today's date on load
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('billDate') as HTMLInputElement;
        if (dateInput) {
            dateInput.value = today;
        }
    }, []);

    const getBillSummary = () => {
        const billNo = (document.getElementById('billNo') as HTMLInputElement)?.value || 'N/A';
        const date = (document.getElementById('billDate') as HTMLInputElement)?.value || 'N/A';
        const name = (document.getElementById('patientName') as HTMLInputElement)?.value || 'Patient';
        const age = (document.getElementById('patientAge') as HTMLInputElement)?.value || '';
        const amount = (document.getElementById('amount') as HTMLInputElement)?.value || '0';

        const lines = [];
        lines.push("Dr. Mohana's Dental Care");
        lines.push("Bill No: " + billNo);
        lines.push("Date: " + date);
        lines.push("Patient: " + name + (age ? " (Age: " + age + ")" : ""));
        lines.push("");
        lines.push("Procedures:");
        for (let i = 1; i <= 4; i++) {
            const procName = (document.getElementById('proc' + i + 'Name') as HTMLInputElement)?.value;
            const procDate = (document.getElementById('proc' + i + 'Date') as HTMLInputElement)?.value;
            if (procName) {
                lines.push(i + ". " + procName + (procDate ? " (on " + procDate + ")" : ""));
            }
        }
        lines.push("");
        lines.push("Amount Received: Rs. " + amount);
        lines.push("");
        lines.push("Thank you for choosing Dr. Mohana's Dental Care!");
        return lines.join("\n");
    };

    const handlePrint = () => {
        window.print();
    };

    const downloadPDF = () => {
        const bill = billRef.current;
        if (!bill) return;

        const billNo = (document.getElementById('billNo') as HTMLInputElement)?.value || 'New';
        const date = (document.getElementById('billDate') as HTMLInputElement)?.value || 'Date';

        // Save original styles
        const origWidth = bill.style.width;
        const origMinHeight = bill.style.minHeight;
        const origBoxShadow = bill.style.boxShadow;
        const origBorderRadius = bill.style.borderRadius;

        // Temporarily resize to fixed pixel width for consistent capture
        bill.style.width = '760px';
        bill.style.minHeight = '1060px';
        bill.style.boxShadow = 'none';
        bill.style.borderRadius = '0';

        // Hide input borders for clean look
        const inputs = bill.querySelectorAll('input');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const savedInputStyles: any[] = [];
        inputs.forEach(function(inp) {
            savedInputStyles.push({
                borderBottom: inp.style.borderBottom,
                background: inp.style.background
            });
            inp.style.borderBottom = '1px solid transparent';
            inp.style.background = 'transparent';
        });

        const opt = {
            margin: [10, 5, 10, 5],
            filename: 'DrMohana_Bill_' + billNo + '_' + date + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 760
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(bill).save().then(function() {
                // Restore original styles
                bill.style.width = origWidth;
                bill.style.minHeight = origMinHeight;
                bill.style.boxShadow = origBoxShadow;
                bill.style.borderRadius = origBorderRadius;
                inputs.forEach(function(inp, idx) {
                    inp.style.borderBottom = savedInputStyles[idx].borderBottom;
                    inp.style.background = savedInputStyles[idx].background;
                });
            }).catch(function() {
                bill.style.width = origWidth;
                bill.style.minHeight = origMinHeight;
                bill.style.boxShadow = origBoxShadow;
                bill.style.borderRadius = origBorderRadius;
                inputs.forEach(function(inp, idx) {
                    inp.style.borderBottom = savedInputStyles[idx].borderBottom;
                    inp.style.background = savedInputStyles[idx].background;
                });
            });
        } else {
            console.error("html2pdf is not loaded");
        }
    };

    const shareEmail = () => {
        const name = (document.getElementById('patientName') as HTMLInputElement)?.value || 'Patient';
        const subject = 'Dental Bill - ' + name + " - Dr. Mohana's Dental Care";
        const body = getBillSummary();
        window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    };

    const clearFields = () => {
        if (window.confirm('Are you sure you want to clear all fields?')) {
            (document.getElementById('bill-form') as HTMLFormElement)?.reset();
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('billDate') as HTMLInputElement;
            if (dateInput) {
                dateInput.value = today;
            }
        }
    };

    return (
        <>
            {/* Toolbar */}
            <div className="toolbar">
                <div className="toolbar-brand">
                    <svg viewBox="0 0 24 24"><path d="M12,22C12,22 17,20.5 19,16.5C21,12.5 19,7 19,7C19,7 18.5,3.5 15,3C11.5,2.5 12,6 12,6C12,6 12.5,2.5 9,3C5.5,3.5 5,7 5,7C5,7 3,12.5 5,16.5C7,20.5 12,22 12,22Z" /></svg>
                    Dr. Mohana's Clinic
                </div>
                <div className="action-buttons">
                    <button className="btn-primary" onClick={handlePrint} aria-label="Print Bill">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print
                    </button>
                    <button className="btn-secondary" onClick={downloadPDF} aria-label="Download PDF">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        PDF
                    </button>
                    <button className="btn-secondary" onClick={shareEmail} aria-label="Share via Email">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        Email
                    </button>
                    <button className="btn-danger" onClick={clearFields} aria-label="Clear Form">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Clear
                    </button>
                </div>
            </div>

            {/* App Shell */}
            <div className="app-shell">
                <div className="bill-container" id="bill-container" ref={billRef}>

                    {/* Header */}
                    <header className="bill-header">
                        <h1 className="clinic-name">Dr. Mohana's Dental Care</h1>
                        <div className="header-details">
                            <div className="header-left">
                                <img src="/logo.jpeg" alt="Dr. Mohana's Dental Care Logo" className="clinic-logo" />
                                <div className="doctor-info">
                                    <div className="doctor-name">Dr. D. Mohanalakshmi M.D.S</div>
                                    <div className="doctor-title">Prosthodontist and Implantologist</div>
                                </div>
                            </div>
                            <div className="header-right">
                                <div className="contact-info">Ph: +91 9003227250</div>
                                <div className="consulting-hours">
                                    Morning: 10.00 am to 1.00 pm<br />
                                    Evening: 5.30 pm to 8.30 pm<br />
                                    (Sunday holiday)
                                </div>
                                <div className="appointment-label">For Appointment</div>
                            </div>
                        </div>
                    </header>

                    <hr className="bill-divider" />

                    <div className="services-strip">
                        Dental Implants &bull; Orthodontics Braces &bull; Invisible Aligners &bull; Root Canal Treatment &bull; Child Dentistry &bull; Crown and Bridge &bull; Complete Dentures &bull; Cosmetic Dentistry
                    </div>

                    <div className="address-line">
                        No. 41/5, Karpagam Gardens, 1st Main Road, Adyar, Chennai - 600 020.
                    </div>

                    {/* Bill Form */}
                    <form id="bill-form" className="bill-form" onSubmit={(e) => e.preventDefault()}>

                        <div className="bill-meta">
                            <div>
                                <label htmlFor="billNo">BILL NO:-</label>
                                <input type="text" id="billNo" className="input-inline bill-no-input" placeholder="001" />
                            </div>
                            <div>
                                <label htmlFor="billDate">DATE:-</label>
                                <input type="date" id="billDate" className="input-inline date-input" />
                            </div>
                        </div>

                        <div className="patient-info">
                            This is to certify that Mr/Mrs/Miss/Master,
                            <label htmlFor="patientName" style={{ display: 'none' }}>Patient Name</label>
                            <input type="text" id="patientName" className="input-inline patient-name-input" placeholder="Patient Name" />
                            aged
                            <label htmlFor="patientAge" style={{ display: 'none' }}>Age</label>
                            <input type="number" id="patientAge" className="input-inline age-input" placeholder="00" min="0" max="150" />
                            yrs
                        </div>

                        <div className="procedures-section">
                            <div className="procedure-row">
                                <div className="procedure-left">
                                    <span>1.</span>
                                    <label htmlFor="proc1Name" style={{ display: 'none' }}>Procedure 1</label>
                                    <input type="text" id="proc1Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc1Date">ON</label>
                                    <input type="date" id="proc1Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row">
                                <div className="procedure-left">
                                    <span>2.</span>
                                    <label htmlFor="proc2Name" style={{ display: 'none' }}>Procedure 2</label>
                                    <input type="text" id="proc2Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc2Date">ON</label>
                                    <input type="date" id="proc2Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row">
                                <div className="procedure-left">
                                    <span>3.</span>
                                    <label htmlFor="proc3Name" style={{ display: 'none' }}>Procedure 3</label>
                                    <input type="text" id="proc3Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc3Date">ON</label>
                                    <input type="date" id="proc3Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                            <div className="procedure-row">
                                <div className="procedure-left">
                                    <span>4.</span>
                                    <label htmlFor="proc4Name" style={{ display: 'none' }}>Procedure 4</label>
                                    <input type="text" id="proc4Name" className="input-inline procedure-name-input" placeholder="Procedure description" />
                                </div>
                                <div className="procedure-right">
                                    <label htmlFor="proc4Date">ON</label>
                                    <input type="date" id="proc4Date" className="input-inline procedure-date-input" />
                                </div>
                            </div>
                        </div>

                        {/* Spacer pushes the amount and signatures to the bottom */}
                        <div className="bill-spacer"></div>

                        <div className="amount-section" style={{ marginBottom: '30px' }}>
                            I have received Rs.
                            <label htmlFor="amount" style={{ display: 'none' }}>Amount</label>
                            <input type="number" id="amount" className="input-inline amount-input" placeholder="0.00" min="0" step="0.01" />
                            for the above mentioned treatment as professional charges.
                        </div>

                        <div className="signatures-section">
                            <div className="signature-box">
                                <div className="signature-line"></div>
                                <div className="signature-label">Doctor's Seal:-</div>
                            </div>
                            <div className="signature-box">
                                <div className="signature-line"></div>
                                <div className="signature-label">Doctor's Signature:</div>
                            </div>
                        </div>
                    </form>

                </div>
            </div>
        </>
    );
}

export default App;
