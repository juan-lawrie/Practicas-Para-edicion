# backend/api/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid

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
    is_active = models.BooleanField(default=True)  # Para eliminación lógica
    deleted_at = models.DateTimeField(null=True, blank=True)  # Fecha de eliminación

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
    # Campos para tracking de intentos de login
    failed_login_attempts = models.IntegerField(default=0)
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    LOCK_TYPE_CHOICES = (
        ('manual', 'Manual'),
        ('automatic', 'Automatic'),
    )
    lock_type = models.CharField(max_length=10, choices=LOCK_TYPE_CHOICES, null=True, blank=True)
    
    # Permitir espacios en el username sobrescribiendo el campo
    username = models.CharField(
        max_length=150,
        unique=True,
        help_text='Requerido. 150 caracteres o menos. Permite espacios y caracteres especiales.',
        error_messages={
            'unique': "Ya existe un usuario con ese nombre de usuario.",
        },
    )
    
    def __str__(self):
        return f"{self.username} - {self.role}"

# Modelo para los productos (eliminar la duplicación)
class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    low_stock_threshold = models.IntegerField(default=10) # Umbral para la alerta de stock
    high_stock_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=2.0) # Multiplicador para stock alto (ej: 2.0 = duplicar, 3.5 = triplicar y medio)
    category = models.CharField(max_length=50, default='Producto') # Categoría del producto
    is_ingredient = models.BooleanField(default=False)
    UNIT_CHOICES = (
        ('g', 'Gramos'),
        ('ml', 'Mililitros'),
        ('unidades', 'Unidades'),
    )
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='unidades')
    # Rendimiento de la receta: cuántas unidades produce UN lote/ejecución de la receta
    recipe_yield = models.IntegerField(default=1)
    # Tasa de pérdida esperada para este producto/insumo (porcentaje como decimal: 0.02 = 2%)
    loss_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0.02)
    is_active = models.BooleanField(default=True)  # Para eliminación lógica
    deleted_at = models.DateTimeField(null=True, blank=True)  # Fecha de eliminación

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
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
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
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    previous_stock = models.DecimalField(max_digits=10, decimal_places=2)
    new_stock = models.DecimalField(max_digits=10, decimal_places=2)
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
    is_active = models.BooleanField(default=True)  # Para eliminación lógica
    deleted_at = models.DateTimeField(null=True, blank=True)  # Fecha de eliminación

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Purchase {self.id} - {self.total_amount}"


class Order(models.Model):
    customer_name = models.CharField(max_length=255)
    fecha_para_la_que_se_quiere_el_pedido = models.DateTimeField(blank=True, null=True)
    payment_method = models.CharField(max_length=100, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Pendiente')
    fecha_de_orden_del_pedido = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-fecha_de_orden_del_pedido']

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
    products = models.ManyToManyField(Product, related_name='low_stock_reports')
    message = models.TextField()
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)

    def __str__(self):
        product_names = ", ".join([p.name for p in self.products.all()[:3]])
        return f"Report for {product_names} by {self.reported_by.username}"


# Modelo para registrar pérdidas de productos e insumos
class LossRecord(models.Model):
    PRODUCT_LOSS_CATEGORIES = (
        ('accidente_fisico', 'Accidentes físicos'),
        ('contaminacion', 'Contaminación'),
        ('vencimiento', 'Vencimiento'),
        ('cadena_frio', 'Perdió la cadena de frío - Temperatura inadecuada'),
    )
    
    INGREDIENT_LOSS_CATEGORIES = (
        ('empaque_danado', 'Empaque dañado'),
        ('sobreuso_receta', 'Sobreuso en receta'),
        ('vencimiento', 'Vencimiento'),
        ('cadena_frio', 'Perdió la cadena de frío - Temperatura inadecuada'),
    )
    
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='loss_records')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20)  # Se valida según si es producto o insumo
    description = models.TextField(blank=True, null=True)
    cost_estimate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    
    def __str__(self):
        return f"Pérdida de {self.quantity} {self.product.unit} de {self.product.name} - {self.get_category_display()}"
    
    def get_category_display(self):
        if self.product.category == 'Insumo':
            categories = dict(self.INGREDIENT_LOSS_CATEGORIES)
        else:
            categories = dict(self.PRODUCT_LOSS_CATEGORIES)
        return categories.get(self.category, self.category)

class RecipeIngredient(models.Model):
    product = models.ForeignKey(Product, related_name='recipe', on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Product, on_delete=models.CASCADE, limit_choices_to={'is_ingredient': True})
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    UNIT_CHOICES = (
        ('g', 'Gramos'),
        ('ml', 'Mililitros'),
        ('unidades', 'Unidades'),
    )
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='g')

    def __str__(self):
        return f"{self.quantity} {self.unit} of {self.ingredient.name} for {self.product.name}"


# Modelo para tokens de recuperación / reseteo de contraseña generados por Gerentes
class ResetToken(models.Model):
    """
    Token de un solo uso para permitir que un usuario restablezca su contraseña.
    El token en claro nunca se almacena; solo se guarda su hash.
    """
    id = models.UUIDField(primary_key=True, editable=False, unique=True, default=uuid.uuid4)
    token_hash = models.CharField(max_length=128)
    target_user = models.ForeignKey('User', on_delete=models.CASCADE, null=True, blank=True, related_name='reset_tokens')
    generated_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_reset_tokens')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    note = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ResetToken for {self.target_user.email} (used={self.used})"

# Modelo para registros de producción
class Production(models.Model):
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    total_units = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Production {self.id} by {self.user.username if self.user else 'Unknown'} - {self.total_units} units"

# Modelo para items individuales de producción
class ProductionItem(models.Model):
    production = models.ForeignKey(Production, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"