
-- Create a seed function that inserts demo data for a given user
-- We use SECURITY DEFINER to bypass RLS for seeding
CREATE OR REPLACE FUNCTION public.seed_demo_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_1 UUID;
  v_property_2 UUID;
  v_stand_1 UUID;
  v_stand_2 UUID;
  v_stand_3 UUID;
  v_stand_4 UUID;
  v_stand_5 UUID;
  v_stand_6 UUID;
  v_activity_1 UUID;
  v_activity_2 UUID;
  v_activity_3 UUID;
  v_activity_4 UUID;
  v_customer_1 UUID;
  v_customer_2 UUID;
  v_customer_3 UUID;
  v_invoice_1 UUID;
  v_invoice_2 UUID;
  v_invoice_3 UUID;
  v_invoice_4 UUID;
  v_invoice_5 UUID;
BEGIN
  -- Properties
  INSERT INTO properties (id, user_id, name, municipality, total_area_ha, productive_forest_ha)
  VALUES
    (gen_random_uuid(), p_user_id, 'Sörgården 1:24', 'Ljusdal', 42.5, 36.2),
    (gen_random_uuid(), p_user_id, 'Norrgården 3:7', 'Hudiksvall', 22.2, 18.5)
  RETURNING id INTO v_property_1;

  SELECT id INTO v_property_2 FROM properties WHERE user_id = p_user_id AND name = 'Norrgården 3:7';
  SELECT id INTO v_property_1 FROM properties WHERE user_id = p_user_id AND name = 'Sörgården 1:24';

  -- Stands for Sörgården
  INSERT INTO stands (id, property_id, name, tree_species, area_ha, age, volume_m3sk, site_index, estimated_value, growth_rate_percent, planned_action, planned_year, notes)
  VALUES
    (gen_random_uuid(), v_property_1, 'Avd 1 – Tallåsen', 'Tall', 8.3, 65, 220, 'T24', 340000, 2.8, 'slutavverkning', 2026, 'Mogen skog, bra kvalitet'),
    (gen_random_uuid(), v_property_1, 'Avd 2 – Grankullen', 'Gran', 6.1, 45, 180, 'G28', 280000, 3.5, 'gallring', 2025, 'Första gallring planerad'),
    (gen_random_uuid(), v_property_1, 'Avd 3 – Björkängen', 'Björk/Löv', 5.7, 15, 45, 'B20', 42000, 4.2, 'röjning', 2025, 'Behöver röjas snarast'),
    (gen_random_uuid(), v_property_1, 'Avd 4 – Stormyran', 'Tall/Gran/Löv', 16.1, 78, 3800, 'T22', 1850000, 2.1, 'slutavverkning', 2025, 'Stor avdelning, stormskador')
  ;

  SELECT id INTO v_stand_1 FROM stands WHERE property_id = v_property_1 AND name LIKE '%Tallåsen%';
  SELECT id INTO v_stand_2 FROM stands WHERE property_id = v_property_1 AND name LIKE '%Grankullen%';
  SELECT id INTO v_stand_3 FROM stands WHERE property_id = v_property_1 AND name LIKE '%Björkängen%';
  SELECT id INTO v_stand_4 FROM stands WHERE property_id = v_property_1 AND name LIKE '%Stormyran%';

  -- Stands for Norrgården
  INSERT INTO stands (id, property_id, name, tree_species, area_ha, age, volume_m3sk, site_index, estimated_value, growth_rate_percent, planned_action, planned_year, notes)
  VALUES
    (gen_random_uuid(), v_property_2, 'Avd 1 – Mossen', 'Gran', 10.2, 35, 120, 'G24', 150000, 3.8, 'gallring', 2027, 'Bra tillväxt'),
    (gen_random_uuid(), v_property_2, 'Avd 2 – Bergsluttningen', 'Tall', 8.3, 55, 195, 'T20', 220000, 2.5, 'ingen åtgärd', NULL, 'Avvakta ytterligare 10 år')
  ;

  SELECT id INTO v_stand_5 FROM stands WHERE property_id = v_property_2 AND name LIKE '%Mossen%';
  SELECT id INTO v_stand_6 FROM stands WHERE property_id = v_property_2 AND name LIKE '%Bergsluttningen%';

  -- Forest Activities
  INSERT INTO forest_activities (id, stand_id, property_id, type, planned_date, estimated_income, estimated_cost, estimated_net, status, notes)
  VALUES
    (gen_random_uuid(), v_stand_4, v_property_1, 'slutavverkning', '2025-09-01', 1786000, 185000, 1601000, 'planned', 'Planerad slutavverkning Stormyran'),
    (gen_random_uuid(), v_stand_3, v_property_1, 'röjning', '2025-06-15', 0, 28000, -28000, 'planned', 'Röjning Björkängen'),
    (gen_random_uuid(), v_stand_2, v_property_1, 'gallring', '2025-10-01', 95000, 22000, 73000, 'planned', 'Första gallring Grankullen'),
    (gen_random_uuid(), v_stand_1, v_property_1, 'slutavverkning', '2026-08-01', 620000, 75000, 545000, 'planned', 'Slutavverkning Tallåsen 2026')
  ;

  SELECT id INTO v_activity_1 FROM forest_activities WHERE stand_id = v_stand_4 AND type = 'slutavverkning';
  SELECT id INTO v_activity_2 FROM forest_activities WHERE stand_id = v_stand_3;
  SELECT id INTO v_activity_3 FROM forest_activities WHERE stand_id = v_stand_2;
  SELECT id INTO v_activity_4 FROM forest_activities WHERE stand_id = v_stand_1;

  -- Customers
  INSERT INTO customers (id, user_id, name, organization_number, email, phone, address)
  VALUES
    (gen_random_uuid(), p_user_id, 'Norra Skog', '556234-5678', 'virke@norraskog.se', '060-123456', 'Storgatan 12, 871 31 Härnösand'),
    (gen_random_uuid(), p_user_id, 'SCA Skog AB', '556012-6293', 'faktura@sca.com', '060-198000', 'Skepparplatsen 1, 851 88 Sundsvall'),
    (gen_random_uuid(), p_user_id, 'Skogssällskapet', '556000-1234', 'info@skogssallskapet.se', '031-7083800', 'Göteborg')
  ;

  SELECT id INTO v_customer_1 FROM customers WHERE user_id = p_user_id AND name = 'Norra Skog';
  SELECT id INTO v_customer_2 FROM customers WHERE user_id = p_user_id AND name = 'SCA Skog AB';
  SELECT id INTO v_customer_3 FROM customers WHERE user_id = p_user_id AND name = 'Skogssällskapet';

  -- Invoices
  INSERT INTO invoices (id, user_id, customer_id, property_id, invoice_number, invoice_date, due_date, description, amount_ex_vat, vat_amount, amount_inc_vat, status, category, linked_activity_id)
  VALUES
    (gen_random_uuid(), p_user_id, v_customer_1, v_property_1, '1001', '2025-01-15', '2025-02-14', 'Gallringsvirke leverans dec 2024', 125000, 31250, 156250, 'paid', 'virkesförsäljning', NULL),
    (gen_random_uuid(), p_user_id, v_customer_2, v_property_1, '1002', '2025-02-01', '2025-03-03', 'Massaved leverans jan 2025', 85000, 21250, 106250, 'paid', 'virkesförsäljning', NULL),
    (gen_random_uuid(), p_user_id, v_customer_1, v_property_1, '1003', '2025-03-01', '2025-03-31', 'Timmer leverans feb 2025', 195000, 48750, 243750, 'unpaid', 'virkesförsäljning', NULL),
    (gen_random_uuid(), p_user_id, v_customer_3, v_property_2, '1004', '2025-02-15', '2025-03-15', 'Skogsbruksplan uppdatering', 45000, 11250, 56250, 'overdue', 'tjänst', NULL),
    (gen_random_uuid(), p_user_id, v_customer_2, v_property_1, '1005', '2025-03-10', '2025-04-09', 'Massaved feb-mars 2025', 62000, 15500, 77500, 'overdue', 'virkesförsäljning', NULL)
  ;

  SELECT id INTO v_invoice_1 FROM invoices WHERE user_id = p_user_id AND invoice_number = '1001';
  SELECT id INTO v_invoice_2 FROM invoices WHERE user_id = p_user_id AND invoice_number = '1002';
  SELECT id INTO v_invoice_3 FROM invoices WHERE user_id = p_user_id AND invoice_number = '1003';

  -- Transactions
  INSERT INTO transactions (user_id, property_id, stand_id, invoice_id, date, type, category, description, amount, vat_amount, payment_method, status)
  VALUES
    (p_user_id, v_property_1, v_stand_2, v_invoice_1, '2025-01-20', 'income', 'virkesförsäljning', 'Betald faktura 1001 – Gallringsvirke', 125000, 31250, 'bank', 'booked'),
    (p_user_id, v_property_1, NULL, v_invoice_2, '2025-02-10', 'income', 'virkesförsäljning', 'Betald faktura 1002 – Massaved', 85000, 21250, 'bank', 'booked'),
    (p_user_id, v_property_1, v_stand_3, NULL, '2025-01-05', 'expense', 'röjning', 'Röjningsarbete Björkängen', 18000, 4500, 'bank', 'booked'),
    (p_user_id, v_property_1, NULL, NULL, '2025-02-15', 'expense', 'plantering', 'Plantinköp vår 2025', 24000, 6000, 'bank', 'booked'),
    (p_user_id, v_property_1, NULL, NULL, '2025-01-30', 'expense', 'väg', 'Vägunderhåll vinter', 12000, 3000, 'bank', 'booked'),
    (p_user_id, v_property_2, NULL, NULL, '2025-03-01', 'expense', 'administration', 'Skogsbruksplan revidering', 8500, 2125, 'bank', 'booked'),
    (p_user_id, v_property_1, NULL, NULL, '2025-03-05', 'income', 'bidrag', 'NOKÅS-bidrag röjning', 15000, 0, 'bank', 'booked'),
    (p_user_id, NULL, NULL, NULL, '2025-01-15', 'expense', 'försäkring', 'Skogsförsäkring helår', 9800, 0, 'bank', 'booked'),
    (p_user_id, NULL, NULL, NULL, '2025-02-28', 'expense', 'ränta', 'Ränta skogskonto', 3200, 0, 'bank', 'booked'),
    (p_user_id, v_property_1, v_stand_4, NULL, '2024-09-15', 'income', 'virkesförsäljning', 'Stormvirke Stormyran', 78000, 19500, 'bank', 'booked'),
    (p_user_id, v_property_1, NULL, NULL, '2024-10-01', 'expense', 'avverkning', 'Avverkningskostnad storm', 32000, 8000, 'bank', 'booked'),
    (p_user_id, v_property_2, v_stand_5, NULL, '2024-11-15', 'income', 'virkesförsäljning', 'Timmer Norrgården', 95000, 23750, 'bank', 'booked')
  ;

  -- Bank Accounts
  INSERT INTO bank_accounts (user_id, bank_name, account_name, account_number_masked, current_balance, last_synced_at, is_connected)
  VALUES
    (p_user_id, 'Handelsbanken', 'Företagskonto', '6112 xxx xxx 4', 342000, now(), true),
    (p_user_id, 'Handelsbanken', 'Skogskonto', '6112 xxx xxx 7', 120000, now(), true)
  ;

  -- Tax Accounts
  INSERT INTO tax_accounts (user_id, current_balance, estimated_tax_to_pay, last_synced_at, is_connected)
  VALUES
    (p_user_id, 24500, 106200, now(), true)
  ;

  -- Tax Scenarios
  INSERT INTO tax_scenarios (user_id, year, estimated_income, estimated_expenses, estimated_profit, estimated_tax, scenario_name, notes)
  VALUES
    (p_user_id, 2025, 345000, 80000, 265000, 72000, 'Nuvarande plan', 'Baseras på nuvarande avverkningsplan'),
    (p_user_id, 2025, 2131000, 265000, 1866000, 504000, 'Avverka Stormyran 2025', 'Med slutavverkning av Avd 4'),
    (p_user_id, 2026, 965000, 155000, 810000, 219000, 'Avverka 2026 istället', 'Skjut avverkning till 2026, lägre marginalskatt')
  ;

  -- Integrations
  INSERT INTO integrations (user_id, type, provider, status, last_synced_at)
  VALUES
    (p_user_id, 'bank', 'Handelsbanken', 'connected', now()),
    (p_user_id, 'skattekonto', 'Skatteverket', 'disconnected', NULL),
    (p_user_id, 'skogsbruksplan', 'pcSKOG', 'disconnected', NULL)
  ;
END;
$$;
