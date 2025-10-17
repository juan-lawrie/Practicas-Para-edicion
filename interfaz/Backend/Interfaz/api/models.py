# backend/api/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser

# Modelo para almacenamiento tipo localStorage por usuario
class UserStorage(models.Model):
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='storage')
    key = models.CharField(max_length=100)
    value = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'key')
        verbose_name = 'User Storage'
        verbose_name_plural = 'User Storages'

    def __str__(self):
        return f"{self.user.username} - {self.key}"

# Modelo para roles
class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    
    def __str__(self):
        return self.name

# Modelo para proveedores
class Supplier(models.Model):
    name = models.CharField(max_length=255)
    cuit = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    products = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.name

# Extender el modelo de usuario de Django para incluir roles
class User(AbstractUser):
    # Definimos los roles según los casos de uso
    ROLE_CHOICES = (
        ('Gerente', 'Gerente'),
        ('Encargado', 'Encargado'),
        ('Panadero', 'Panadero'),
        ('Cajero', 'Cajero'),
    )
    # Quitar default='Cajero' para que sea obligatorio
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    # Añadimos la columna `is_active` por defecto
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.username} - {self.role}"

# Modelo para los productos (eliminar la duplicación)
class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=10) # Umbral para la alerta de stock
    category = models.CharField(max_length=50, default='Producto') # Categoría del producto

    def __str__(self):
        return self.name

# Modelo para movimientos de caja
class CashMovement(models.Model):
    MOVEMENT_CHOICES = (
        ('Entrada', 'Entrada'),
        ('Salida', 'Salida'),
    )
    type = models.CharField(max_length=10, choices=MOVEMENT_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True, null=True)

# Modelo para cambios de inventario (no por ventas)
class InventoryChange(models.Model):
    CHANGE_CHOICES = (
        ('Entrada', 'Entrada'),
        ('Salida', 'Salida'),
    )
    type = models.CharField(max_length=10, choices=CHANGE_CHOICES)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    reason = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f'{self.type} de {self.quantity} de {self.product.name}'

# Modelo para auditoría de cambios de inventario
class InventoryChangeAudit(models.Model):
    inventory_change = models.ForeignKey('InventoryChange', on_delete=models.SET_NULL, null=True, blank=True, related_name='audits')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=50, blank=True, null=True)
    change_type = models.CharField(max_length=10, choices=InventoryChange.CHANGE_CHOICES)
    quantity = models.PositiveIntegerField()
    previous_stock = models.IntegerField()
    new_stock = models.IntegerField()
    reason = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        user_repr = self.user.username if self.user else 'Sistema'
        return f"Audit: {self.change_type} {self.quantity} on {self.product.name} by {user_repr} at {self.timestamp}"


# ---------------------- Modelos relacionados con ventas, compras y pedidos (definidos en migraciones)
class Sale(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Sale {self.id} - {self.total_amount}"


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product.name} @ {self.price}"


class Purchase(models.Model):
    STATUS_CHOICES = (
        ('Pendiente', 'Pendiente'),
        ('Aprobada', 'Aprobada'),
        ('Rechazada', 'Rechazada'),
    )
    date = models.CharField(max_length=50, blank=True, null=True)
    supplier = models.CharField(max_length=255, blank=True, null=True)
    supplier_id = models.IntegerField(blank=True, null=True)
    items = models.JSONField(default=list)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    approved_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_purchases')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Purchase {self.id} - {self.total_amount}"


class Order(models.Model):
    customer_name = models.CharField(max_length=255)
    date = models.DateField(blank=True, null=True)
    payment_method = models.CharField(max_length=100, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.id} - {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product_name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"


class UserQuery(models.Model):
    query_type = models.CharField(max_length=50)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    results_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    user = models.ForeignKey('User', on_delete=models.CASCADE)

    class Meta:
        ordering = ['-updated_at']
        unique_together = ('user', 'query_type')

    def __str__(self):
        return f"Query {self.query_type} by {self.user.username}"

class LowStockReport(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    message = models.TextField()
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)

    def __str__(self):
        return f"Report for {self.product.name} by {self.reported_by.username}"