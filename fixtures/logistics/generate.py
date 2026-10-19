"""Reproducible, original synthetic PDF inputs. No expected results supplied to app."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

BASE = Path(__file__).resolve().parent
DOCS = [
 ('carrier-invoice.pdf', 'CARRIER INVOICE', 'Faro Ocean Demo', 'CAR-DEMO-001', '212.00', [
  'Description                         Qty  Unit      Rate USD   Amount USD',
  'Ocean handling                       1  service     150.00       150.00',
  'Pickup - Warehouse A to Port A        1  trip         62.00        62.00',
  'Tax amount: 0.00 USD (synthetic scenario assumption)',
  'Service date: 2026-10-10', 'Service reference: PICK-DEMO-001',
  'This document bills a service; it does not prove who performed it.']),
 ('transport-invoice.pdf', 'TRANSPORT INVOICE', 'Ruta Norte Demo', 'TRN-DEMO-001', '62.00', [
  'Description                         Qty  Unit      Rate USD   Amount USD',
  'Pickup - Warehouse A to Port A        1  trip         62.00        62.00',
  'Tax amount: 0.00 USD (synthetic scenario assumption)',
  'Service date: 2026-10-10', 'Service reference: PICK-DEMO-001',
  'Carrier service excluded from this transport invoice.']),
 ('carrier-agreement.pdf', 'CARRIER AGREEMENT', 'Faro Ocean Demo', 'AGR-DEMO-001', '150.00', [
  'Valid from: 2026-10-01', 'Valid until: 2026-10-31',
  'Validity date basis: service-date',
  'Origin restriction: unrestricted', 'Destination restriction: unrestricted',
  'Transport mode restriction: unrestricted', 'Equipment type restriction: unrestricted',
  'Contracting party restriction: unrestricted', 'Service restriction: unrestricted',
  'Ocean handling: 1 service at 150.00 USD.',
  'Scope: Port A handling for one demo container.',
  'Excludes pickup Warehouse A to Port A; ordered separately from Ruta Norte Demo.',
  'Demo agreement accepted 2026-10-01. Not an internal estimate.',
  'No external commercial terms or real tariff are incorporated.']),
 ('pickup-record.pdf', 'OPERATIONAL RECORD', 'Ruta Norte Demo', 'OPS-DEMO-001', None, [
  'Service reference: PICK-DEMO-001', 'Service date: 2026-10-10',
  'Route: Warehouse A to Port A', 'Assigned provider: Ruta Norte Demo',
  'Recorded performed by: Ruta Norte Demo', 'Status: Completed (synthetic record)',
  'Demo container: UNIT-DEMO-001 (not an ISO container identification)',
  'No real signature, fiscal identity, bank account or delivery proof.']),
]

def build(only=None):
 for filename,title,provider,number,total,lines in DOCS:
  if only is not None and filename not in only: continue
  path=BASE/'source-documents'/filename
  c=canvas.Canvas(str(path),pagesize=A4,invariant=1)
  c.setTitle('DEMO - '+title)
  c.setAuthor('Reconcile synthetic fixtures')
  c.setFillGray(.1); c.setFont('Helvetica-Bold',11)
  c.drawString(42,800,'DEMO - sin validez comercial')
  c.setFont('Helvetica-Bold',18); c.drawString(42,762,title)
  c.setStrokeGray(.8); c.line(42,743,553,743)
  c.setFont('Helvetica',11)
  fields=[f'Provider: {provider}',f'Document number: {number}',
   'Operation reference: OP-DEMO-062','Date: 2026-10-12','Currency: USD']
  if total is not None: fields.append(f'Total: {total}')
  y=715
  for line in fields:
   c.drawString(42,y,line); y-=22
  y-=18
  for line in lines:
   c.setFont('Courier' if 'Qty' in line or 'service   ' in line or 'trip   ' in line else 'Helvetica',9)
   c.drawString(42,y,line); y-=23
  c.setStrokeGray(.8); c.line(42,90,553,90)
  c.setFont('Helvetica',9)
  c.drawString(42,70,'Fictional companies and references. No payment is due. Page 1 of 1.')
  c.drawString(42,54,'Demo format v1 - extract text, verify evidence and review missing fields.')
  c.save()
if __name__=='__main__': build()
