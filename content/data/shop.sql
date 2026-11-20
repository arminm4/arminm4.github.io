-- Sample "shop" database used by every SQL example and exercise (SQLite dialect).
-- Data is generated deterministically, so everyone gets identical results.

CREATE TABLE categories (
  category_id INTEGER PRIMARY KEY,
  name        TEXT NOT NULL
);
INSERT INTO categories VALUES
 (1,'Laptops'),(2,'Phones'),(3,'Audio'),(4,'Accessories'),(5,'Books'),(6,'Home'),(7,'Gaming'),(8,'Wearables');

CREATE TABLE products (
  product_id  INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(category_id),
  unit_price  REAL NOT NULL,
  cost        REAL NOT NULL,
  launched    DATE
);
INSERT INTO products VALUES
 (1,'AeroBook 13',1,1199.00,860.00,'2023-03-01'),
 (2,'AeroBook 15 Pro',1,1799.00,1290.00,'2023-09-15'),
 (3,'StudyBook Lite',1,649.00,470.00,'2022-08-20'),
 (4,'Pixelon 8',2,799.00,520.00,'2023-10-05'),
 (5,'Pixelon 8 Mini',2,599.00,400.00,'2024-02-10'),
 (6,'Nova A5',2,299.00,190.00,'2022-11-11'),
 (7,'BassPods',3,129.00,55.00,'2023-01-20'),
 (8,'StudioCans X',3,349.00,170.00,'2023-06-01'),
 (9,'RoomBeam Speaker',3,199.00,95.00,'2022-05-05'),
 (10,'USB-C Hub 7-in-1',4,59.00,21.00,'2022-01-15'),
 (11,'MagCharge Stand',4,79.00,30.00,'2023-04-04'),
 (12,'Laptop Sleeve',4,39.00,12.00,'2021-09-09'),
 (13,'Python Crash Notes',5,35.00,9.00,'2023-02-02'),
 (14,'Data Stories',5,42.00,11.00,'2022-07-07'),
 (15,'Systems at Scale',5,55.00,15.00,'2024-01-08'),
 (16,'Smart Lamp',6,49.00,20.00,'2022-10-10'),
 (17,'Air Purifier Mini',6,159.00,80.00,'2023-08-08'),
 (18,'Robo Vacuum S',6,399.00,240.00,'2024-03-03'),
 (19,'GameBox One',7,499.00,380.00,'2023-11-24'),
 (20,'ProPad Controller',7,69.00,28.00,'2023-11-24'),
 (21,'Quest Headset',7,429.00,300.00,'2024-05-05'),
 (22,'FitBand 3',8,99.00,45.00,'2023-05-15'),
 (23,'Chrono Watch S',8,329.00,190.00,'2023-09-01'),
 (24,'Ring Tracker',8,279.00,150.00,'2024-06-06');

CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,
  city        TEXT,
  country     TEXT,
  signup_date DATE,
  segment     TEXT CHECK (segment IN ('consumer','student','business'))
);
INSERT INTO customers VALUES
 (1,'Sara Ahmadi','sara@example.com','Tehran','Iran','2023-01-05','consumer'),
 (2,'Liam Becker','liam@example.com','Berlin','Germany','2023-01-12','business'),
 (3,'Noor Haddad','noor@example.com','Dubai','UAE','2023-01-20','consumer'),
 (4,'Emre Kaya','emre@example.com','Istanbul','Turkey','2023-02-02','student'),
 (5,'Olivia Brown','olivia@example.com','Toronto','Canada','2023-02-14','consumer'),
 (6,'Reza Karimi','reza@example.com','Isfahan','Iran','2023-02-21','student'),
 (7,'Hannah Schulz','hannah@example.com','Munich','Germany','2023-03-03','consumer'),
 (8,'James Wilson','james@example.com','London','UK','2023-03-10','business'),
 (9,'Mina Rahimi','mina@example.com','Shiraz','Iran','2023-03-18','consumer'),
 (10,'Daan de Vries','daan@example.com','Amsterdam','Netherlands','2023-03-29','business'),
 (11,'Ava Martin','ava@example.com','New York','USA','2023-04-04','consumer'),
 (12,'Ali Mohammadi','ali@example.com','Tehran','Iran','2023-04-15','business'),
 (13,'Zeynep Arslan','zeynep@example.com','Ankara','Turkey','2023-04-22','consumer'),
 (14,'Noah Smith','noah@example.com','Chicago','USA','2023-05-01','student'),
 (15,'Fatima Al-Sayed','fatima@example.com','Abu Dhabi','UAE','2023-05-09','business'),
 (16,'Lukas Wagner','lukas@example.com','Hamburg','Germany','2023-05-20','student'),
 (17,'Emma Taylor','emma@example.com','Manchester','UK','2023-06-02','consumer'),
 (18,'Parisa Hosseini','parisa@example.com','Mashhad','Iran','2023-06-11','consumer'),
 (19,'Mason Clark','mason@example.com','Vancouver','Canada','2023-06-25','business'),
 (20,'Sophie Jansen','sophie@example.com','Rotterdam','Netherlands','2023-07-04','consumer'),
 (21,'Omid Rostami','omid@example.com','Tabriz','Iran','2023-07-15','student'),
 (22,'Isabella Lopez','isabella@example.com','Austin','USA','2023-08-01','consumer'),
 (23,'Can Demir','can@example.com','Izmir','Turkey','2023-08-19','business'),
 (24,'Leila Nazari','leila@example.com','Tehran','Iran','2023-09-03','consumer'),
 (25,'Ben Fischer','ben@example.com','Cologne','Germany','2023-09-17','consumer'),
 (26,'Grace Hall','grace@example.com','Leeds','UK','2023-10-02','student'),
 (27,'Yusuf Rahman','yusuf@example.com','Sharjah','UAE','2023-10-21','consumer'),
 (28,'Chloe Roy','chloe@example.com','Montreal','Canada','2023-11-08','student'),
 (29,'Kian Jafari','kian@example.com','Karaj','Iran','2023-11-30','business'),
 (30,'Mila Visser','mila@example.com','Utrecht','Netherlands','2023-12-12',NULL);

CREATE TABLE orders (
  order_id    INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  order_date  DATE NOT NULL,
  status      TEXT NOT NULL,
  channel     TEXT NOT NULL
);
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 400)
INSERT INTO orders
SELECT i,
       1 + CAST(28.0 * ((i * 7919) % 1000) * ((i * 7919) % 1000) / 1000000.0 AS INTEGER),
       date('2024-01-01', '+' || ((i * 53 + (i % 7) * 11) % 731) || ' days'),
       CASE WHEN i % 23 = 0 THEN 'cancelled' WHEN i % 11 = 0 THEN 'returned' WHEN i % 29 = 0 THEN 'pending' ELSE 'delivered' END,
       CASE i % 3 WHEN 0 THEN 'web' WHEN 1 THEN 'app' ELSE 'store' END
FROM n;

CREATE TABLE order_items (
  order_id   INTEGER NOT NULL REFERENCES orders(order_id),
  line_no    INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL,
  discount   REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (order_id, line_no)
);
WITH RECURSIVE k(j) AS (SELECT 1 UNION ALL SELECT j + 1 FROM k WHERE j < 3)
INSERT INTO order_items
SELECT o.order_id, k.j,
       p.product_id,
       1 + (o.order_id + k.j) % 4 - CASE WHEN p.unit_price > 500 THEN (o.order_id + k.j) % 4 ELSE 0 END,
       p.unit_price,
       CASE WHEN (o.order_id + k.j) % 5 = 0 THEN 0.10 ELSE 0 END
FROM orders o
JOIN k ON k.j <= 1 + o.order_id % 3
JOIN products p ON p.product_id = 1 + (o.order_id * 13 + k.j * 7 + o.order_id / 9) % 24;

CREATE TABLE employees (
  employee_id INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  title       TEXT,
  department  TEXT,
  manager_id  INTEGER REFERENCES employees(employee_id),
  hired       DATE,
  salary      INTEGER
);
INSERT INTO employees VALUES
 (1,'Nadia Farahani','CEO','Management',NULL,'2019-01-07',9800),
 (2,'Tom Becker','Head of Sales','Sales',1,'2019-06-01',7200),
 (3,'Shirin Moradi','Head of Data','Data',1,'2020-02-15',7600),
 (4,'Arash Kamali','Sales Rep','Sales',2,'2021-03-10',4100),
 (5,'Julia Weber','Sales Rep','Sales',2,'2022-09-01',3900),
 (6,'Hamed Azizi','Data Analyst','Data',3,'2021-11-20',4800),
 (7,'Elena Rossi','BI Developer','Data',3,'2022-04-11',5200),
 (8,'Samir Haddad','Data Engineer','Data',3,'2023-01-09',5600),
 (9,'Maryam Ebrahimi','Support Lead','Support',1,'2020-08-03',5000),
 (10,'Kevin Park','Support Agent','Support',9,'2023-06-19',3300);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_items_product ON order_items(product_id);

-- Convenience view: one row per order line with revenue and margin.
CREATE VIEW sales AS
SELECT o.order_id, o.order_date, o.status, o.channel,
       c.customer_id, c.country, c.segment,
       p.product_id, p.name AS product, cat.name AS category,
       oi.quantity,
       ROUND(oi.quantity * oi.unit_price * (1 - oi.discount), 2) AS revenue,
       ROUND(oi.quantity * (oi.unit_price * (1 - oi.discount) - p.cost), 2) AS margin
FROM order_items oi
JOIN orders o     ON o.order_id = oi.order_id
JOIN customers c  ON c.customer_id = o.customer_id
JOIN products p   ON p.product_id = oi.product_id
JOIN categories cat ON cat.category_id = p.category_id;
