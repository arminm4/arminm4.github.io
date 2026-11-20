---
id: py-w5
title: Object-Oriented Programming in Depth
week: Week 5
summary: Class design, special (dunder) methods, properties and encapsulation, inheritance and polymorphism, abstract classes, dataclasses, exceptions and composition.
builds_on: py-w4
leads_to: py-p1, fs-w3, ai-w7
---

Last week introduced objects. This week you design them well: classes that protect their own rules, behave like built-in types, share behaviour through inheritance or composition, and fail with clear exceptions. PyTorch models (`nn.Module`), FastAPI/Pydantic schemas and LangGraph states are all classes, so these skills transfer directly.

# Lesson: Classes, attributes and special methods (30 min)

### Instance vs class attributes

```python
class Product:
    tax_rate = 0.09                      # class attribute: shared by all instances
    count = 0

    def __init__(self, name, price):
        self.name = name                 # instance attributes: per object
        self.price = price
        Product.count += 1

    def price_with_tax(self):
        return round(self.price * (1 + self.tax_rate), 2)

p1, p2 = Product("Pen", 2.0), Product("Book", 20.0)
print(p1.price_with_tax(), p2.price_with_tax(), Product.count)
```

### Special ("dunder") methods make objects feel native

```python
class Money:
    def __init__(self, amount, currency="USD"):
        self.amount, self.currency = round(amount, 2), currency

    def __repr__(self):                  # for developers / debugging
        return f"Money({self.amount}, {self.currency!r})"
    def __str__(self):                   # for users (print)
        return f"{self.amount:,.2f} {self.currency}"
    def __add__(self, other):            # m1 + m2
        if self.currency != other.currency:
            raise ValueError("currency mismatch")
        return Money(self.amount + other.amount, self.currency)
    def __eq__(self, other):             # m1 == m2
        return (self.amount, self.currency) == (other.amount, other.currency)
    def __lt__(self, other):             # m1 < m2 (enables sorted)
        return self.amount < other.amount
    def __bool__(self):
        return self.amount != 0

a, b = Money(10.5), Money(4.25)
print(a + b, repr(a + b), a == Money(10.5), sorted([a, b]), bool(Money(0)))
```

Other useful ones: `__len__`, `__getitem__` (indexing), `__iter__` (for loops), `__contains__` (`in`), `__call__` (`obj()`), and `__enter__`/`__exit__` (`with`).

### Class methods and static methods

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    @classmethod
    def from_fahrenheit(cls, f):          # alternative constructor
        return cls((f - 32) * 5 / 9)

    @staticmethod
    def is_valid(c):                       # utility; needs neither self nor cls
        return c >= -273.15

t = Temperature.from_fahrenheit(212)
print(t.celsius, Temperature.is_valid(-300))
```

> [!recap]
> - Class attributes are shared; instance attributes belong to each object.
> - Dunder methods plug your class into Python's syntax: `+`, `==`, `<`, `len`, `for`, `with`.
> - `@classmethod` for alternative constructors, `@staticmethod` for helpers.

# Lesson: Encapsulation and properties (20 min)

Encapsulation means an object **protects its invariants**: the rules that must always hold, like "balance never negative".

Python has no truly private attributes. It uses conventions:
- `_name` (single underscore): internal, "please don't touch".
- `__name` (double underscore): **name-mangled** to `_ClassName__name`, to avoid accidental clashes in subclasses.

### Properties: attribute syntax, method power

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self._balance = 0
        self.balance = balance          # goes through the setter -> validated

    @property
    def balance(self):                  # read like an attribute: acc.balance
        return self._balance

    @balance.setter
    def balance(self, value):
        if value < 0:
            raise ValueError("balance cannot be negative")
        self._balance = value

    def withdraw(self, amount):
        self.balance = self.balance - amount   # reuses the validation

acc = Account("Sara", 100)
acc.withdraw(30)
print(acc.balance)
try:
    acc.withdraw(500)
except ValueError as e:
    print("refused:", e)
```

Start with plain attributes. Convert to a property later, **without changing callers**, if you need validation or computed values.

> [!recap]
> - `_internal` by convention; `__mangled` to avoid clashes in subclasses.
> - `@property` and setters enforce invariants behind attribute syntax.

# Lesson: Inheritance, polymorphism and abstract classes (30 min)

### Inheritance and `super()`

A subclass **is a** specialized version of its parent. It inherits everything, and can **override** or **extend** behaviour.

```python
class Employee:
    def __init__(self, name, salary):
        self.name, self.salary = name, salary
    def monthly_cost(self):
        return self.salary
    def describe(self):
        return f"{self.name} costs {self.monthly_cost():,} per month"

class Manager(Employee):
    def __init__(self, name, salary, bonus):
        super().__init__(name, salary)     # reuse the parent's setup
        self.bonus = bonus
    def monthly_cost(self):                # override
        return super().monthly_cost() + self.bonus

team = [Employee("Liam", 4000), Manager("Sara", 6000, 1500)]
for person in team:
    print(person.describe())              # polymorphism: same call, different behaviour
print(isinstance(team[1], Employee), Manager.__mro__)
```

**Polymorphism**: code written against the general interface (`describe()`) works for every subclass. Python goes further with **duck typing**: any object with the right methods works, whether or not it inherits from anything ("if it quacks like a duck…").

### Abstract base classes: enforcing an interface

```python
from abc import ABC, abstractmethod
import math

class Shape(ABC):
    @abstractmethod
    def area(self): ...
    def describe(self):
        return f"{type(self).__name__} with area {self.area():.2f}"

class Circle(Shape):
    def __init__(self, r): self.r = r
    def area(self): return math.pi * self.r ** 2

class Rect(Shape):
    def __init__(self, w, h): self.w, self.h = w, h
    def area(self): return self.w * self.h

for s in [Circle(1), Rect(2, 3)]:
    print(s.describe())
# Shape() -> TypeError: Can't instantiate abstract class
```

### Composition over inheritance

Inheritance creates tight coupling. Often it's better to **have** a part than to **be** a subtype:

```python
class Engine:
    def start(self): return "vroom"

class Car:                       # Car HAS an Engine (composition)
    def __init__(self, engine): self.engine = engine
    def drive(self): return self.engine.start() + " → driving"

print(Car(Engine()).drive())
```

> [!tip] A rule of thumb
> Use inheritance for genuine "is-a" relationships with shared behaviour (a `Manager` *is an* `Employee`). Use composition for "has-a" and for swapping parts (a chatbot *has a* model client, *has a* memory store). Swappable parts make testing easy: pass in a fake LLM client.

> [!connect] PyTorch is inheritance + composition
> `class Net(nn.Module)` inherits training machinery from `nn.Module` and is *composed* of layers (`self.fc1 = nn.Linear(...)`). See AI week 7.

> [!recap]
> - `super()` reuses parent behaviour. Overriding gives you polymorphism.
> - ABCs with `@abstractmethod` define required interfaces.
> - Prefer composition for "has-a" and swappable parts.

# Lesson: Dataclasses and custom exceptions (25 min)

### Dataclasses: less boilerplate for data-holding classes

```python
from dataclasses import dataclass, field

@dataclass(order=True)
class Task:
    priority: int
    title: str = field(compare=False)
    tags: list[str] = field(default_factory=list, compare=False)   # safe mutable default
    done: bool = field(default=False, compare=False)

tasks = [Task(2, "Write tests"), Task(1, "Fix bug", ["urgent"]), Task(3, "Refactor")]
print(sorted(tasks)[0])
print(Task(1, "x") == Task(1, "y"))   # compares only the 'priority' field here
```

`@dataclass` generates `__init__`, `__repr__` and `__eq__` (plus ordering with `order=True`). Add `frozen=True` for immutable value objects. **Type hints** (`priority: int`) document intent; tools like mypy check them. Pydantic (Full-Stack week 3) uses the same syntax, but also *validates* the types at runtime.

### Exceptions: failing clearly

```python
class InsufficientFunds(Exception):
    """Raised when a withdrawal exceeds the balance."""
    def __init__(self, needed, available):
        super().__init__(f"need {needed}, have {available}")
        self.needed, self.available = needed, available

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFunds(amount, balance)
    return balance - amount

try:
    withdraw(100, 250)
except InsufficientFunds as e:
    print("Error:", e, "| short by", e.needed - e.available)
else:
    print("no error")          # runs if no exception happened
finally:
    print("always runs (cleanup)")
```

Guidelines:
- Catch **specific** exceptions. Never write a bare `except:`, which also swallows bugs and Ctrl+C.
- Raise early, with useful messages. Create a custom exception hierarchy for your domain.
- Use `raise ... from err` to keep the original cause when you translate errors.

> [!recap]
> - `@dataclass` gives you `__init__`/`__repr__`/`__eq__` for free. Use `default_factory` for mutable defaults.
> - Custom exceptions subclass `Exception`. Use `try/except/else/finally` and catch specific errors.

# Quiz

## What is the difference between `__repr__` and `__str__`?
- [ ] There is none
- [x] `__repr__` is an unambiguous developer view; `__str__` is the readable user view used by print
- [ ] `__str__` is only for numbers
- [ ] `__repr__` is called by `+`
> `print(obj)` uses `__str__` (falling back to `__repr__`). The REPL and containers use `__repr__`.

## What does `super().__init__(name, salary)` do in a subclass?
- [ ] Creates a new parent object
- [x] Runs the parent class's initializer on this same instance
- [ ] Copies the parent's attributes to a new class
- [ ] Calls the child's __init__ again
> It reuses the parent's setup logic for `self`.

## Why use a `@property` with a setter for `balance`?
- [ ] To make it faster
- [x] To validate assignments (e.g. reject negatives) while keeping attribute syntax
- [ ] Properties are required for all attributes
- [ ] To make it a class attribute
> Callers write `acc.balance = x`, and your validation still runs.

## What happens when you instantiate a class that has an unimplemented `@abstractmethod`?
- [ ] It works normally
- [x] TypeError: can't instantiate abstract class
- [ ] The method returns None
- [ ] A warning is printed
> ABCs force subclasses to implement the required methods.

## Which relationship suggests composition rather than inheritance?
- [ ] A Manager is an Employee
- [x] A Chatbot has an LLM client and a memory store
- [ ] A Circle is a Shape
- [ ] A SavingsAccount is an Account
> "Has-a" relationships and swappable parts suit composition.

## In a dataclass, why write `tags: list = field(default_factory=list)`?
- [ ] It's faster
- [x] To give each instance its own new list instead of a shared mutable default
- [ ] Lists aren't allowed in dataclasses
- [ ] To make tags immutable
> Same reason as the mutable-default trap with functions.

## Which is the best practice for exceptions?
- [ ] `except:` catching everything
- [x] Catch specific exceptions and raise clear, domain-specific ones
- [ ] Return -1 instead of raising
- [ ] Print the error and continue silently
> Specific handling keeps real bugs visible.

# Exercise: Shopping cart with operator overloading

Build two classes:

- `Item`, a `@dataclass` with `name: str`, `price: float` and `qty: int = 1`.
- `Cart`, with:
  - `add(item)`: adds an Item. If an item with the same name exists, increase its `qty` instead.
  - `__len__`: the total quantity of all items.
  - `__contains__(name)`: `"Pen" in cart`.
  - `total` (a **property**): the sum of price × qty, rounded to 2 decimals.
  - `__add__(other)`: returns a **new** Cart containing the items of both (merging quantities). It must not modify either cart.

## Starter

```python
from dataclasses import dataclass

@dataclass
class Item:
    pass

class Cart:
    pass
```

## Tests

```python
ns = load()
Item, Cart = ns["Item"], ns["Cart"]
c = Cart()
c.add(Item("Pen", 1.5, 2)); c.add(Item("Book", 12.0)); c.add(Item("Pen", 1.5, 1))
assert len(c) == 4, len(c)
assert "Pen" in c and "Bag" not in c
assert c.total == 16.5, c.total
d = Cart(); d.add(Item("Bag", 30.0)); d.add(Item("Pen", 1.5))
e = c + d
assert len(e) == 6 and e.total == 48.0, (len(e), e.total)
assert len(c) == 4 and len(d) == 2, "originals must be unchanged"
assert isinstance(type(c).__dict__["total"], property), "total should be a property"
```

## Hint

Store the items in a dict `{name: Item}`. In `add`, copy the incoming item (`Item(item.name, item.price, item.qty)`) so that later changes don't leak between carts. `__add__` creates `Cart()` and adds copies of everything from both carts.

## Solution

```python
from dataclasses import dataclass

@dataclass
class Item:
    name: str
    price: float
    qty: int = 1

class Cart:
    def __init__(self):
        self._items = {}

    def add(self, item):
        if item.name in self._items:
            self._items[item.name].qty += item.qty
        else:
            self._items[item.name] = Item(item.name, item.price, item.qty)

    def __len__(self):
        return sum(i.qty for i in self._items.values())

    def __contains__(self, name):
        return name in self._items

    @property
    def total(self):
        return round(sum(i.price * i.qty for i in self._items.values()), 2)

    def __add__(self, other):
        merged = Cart()
        for cart in (self, other):
            for it in cart._items.values():
                merged.add(it)
        return merged
```

# Sources

- [Python Tutorial: Classes (inheritance, private variables)](https://docs.python.org/3/tutorial/classes.html)
- [Python docs: Data model (special method names)](https://docs.python.org/3/reference/datamodel.html#special-method-names)
- [Python docs: dataclasses](https://docs.python.org/3/library/dataclasses.html), [abc](https://docs.python.org/3/library/abc.html)
- [Python Tutorial: Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html)
- *Fluent Python, 2nd ed.*: Python data model chapters; *Design Patterns* (GoF), "favor composition over inheritance"
