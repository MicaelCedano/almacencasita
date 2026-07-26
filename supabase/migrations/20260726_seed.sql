-- Admin por defecto (password: admin123)
insert into public.profiles (username, password_hash, full_name, role, approved)
values ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Administrador', 'admin', true);

-- Celulares de prueba
insert into public.products (codigo, nombre, marca, color, capacidad, descripcion, cajas, unidades_por_caja, cantidad)
values
  ('IPHONE-15-PRO', 'iPhone 15 Pro Max', 'Apple', 'Titanio Natural', '8+256GB', 'Celular color titanio natural, importado', 5, 10, 50),
  ('GALAXY-S24-U', 'Samsung Galaxy S24 Ultra', 'Samsung', 'Titanio Gris', '12+512GB', 'Celular color gris titanio con S-Pen', 3, 10, 30),
  ('XIAOMI-14-ULTRA', 'Xiaomi 14 Ultra', 'Xiaomi', 'Negro', '16+512GB', 'Celular con cámara profesional Leica color negro', 8, 5, 40);
