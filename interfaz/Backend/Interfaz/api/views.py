from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.permissions import SAFE_METHODS, BasePermission
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Product, CashMovement, InventoryChange, Sale, UserQuery, Supplier, Role, LowStockReport
from django.conf import settings
from django.utils import timezone
from .serializers import (
    UserSerializer, UserCreateSerializer, ProductSerializer,
    CashMovementSerializer, InventoryChangeSerializer, SaleSerializer,
    UserQuerySerializer, SupplierSerializer, UserStorageSerializer, RoleSerializer, UserUpdateSerializer,
    LowStockReportSerializer, InventoryChangeAuditSerializer
)
from .models import UserStorage

# Permiso personalizado para rol de Gerente
class IsGerente(BasePermission):
    """
    Permiso personalizado para permitir acceso solo a usuarios con el rol 'Gerente'.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and getattr(request.user, 'role', None) and request.user.role.name == 'Gerente'

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class IsCajeroOrPanadero(BasePermission):
    """
    Custom permission to only allow users with the 'Cajero' or 'Panadero' role.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and hasattr(request.user, 'role') and request.user.role):
            return False
        return request.user.role.name in ['Cajero', 'Panadero']

class LowStockReportCreateView(generics.CreateAPIView):
    queryset = LowStockReport.objects.all()
    serializer_class = LowStockReportSerializer
    permission_classes = [IsAuthenticated, IsCajeroOrPanadero]

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)

class LowStockReportListView(generics.ListAPIView):
    queryset = LowStockReport.objects.all().order_by('-created_at')
    serializer_class = LowStockReportSerializer
    permission_classes = [IsAuthenticated, IsGerente]

class LowStockReportUpdateView(generics.UpdateAPIView):
    queryset = LowStockReport.objects.all()
    serializer_class = LowStockReportSerializer
    permission_classes = [IsAuthenticated, IsGerente]

# ViewSet para Roles (solo lectura)
class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]

# Vista para obtener datos del usuario autenticado (/api/users/me/)
class UserStorageViewSet(viewsets.ModelViewSet):
    serializer_class = UserStorageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserStorage.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def keys(self, request):
        """Obtener todas las claves almacenadas para el usuario autenticado."""
        keys = list(UserStorage.objects.filter(user=request.user).values_list('key', flat=True))
        return Response({'keys': keys})

    @action(detail=False, methods=['post'])
    def save(self, request):
        """Guardar o actualizar un valor (saveLS). Espera {key, value}."""
        key = request.data.get('key')
        value = request.data.get('value')
        if not key:
            return Response({'error': 'Key requerida'}, status=400)
        obj, created = UserStorage.objects.update_or_create(
            user=request.user, key=key,
            defaults={'value': value}
        )
        return Response({'success': True, 'created': created, 'key': key, 'value': value})

    @action(detail=False, methods=['get'])
    def load(self, request):
        """Obtener un valor por clave (loadLS). Recibe ?key=..."""
        key = request.query_params.get('key')
        if not key:
            return Response({'error': 'Key requerida'}, status=400)
        obj = UserStorage.objects.filter(user=request.user, key=key).first()
        if not obj:
            return Response({'value': None, 'found': False})
        return Response({'value': obj.value, 'found': True})

    @action(detail=False, methods=['post'])
    def remove(self, request):
        """Eliminar un valor por clave (removeLS). Espera {key}."""
        key = request.data.get('key')
        if not key:
            return Response({'error': 'Key requerida'}, status=400)
        deleted, _ = UserStorage.objects.filter(user=request.user, key=key).delete()
        return Response({'success': True, 'deleted': bool(deleted), 'key': key})

# ViewSet para la gestión de proveedores (CRUD)
class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    
    def get_permissions(self):
        """
        - Gerente puede hacer todo (CRUD).
        - Otros usuarios autenticados solo pueden leer (list, retrieve).
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsGerente]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

from .models import Purchase
from .serializers import PurchaseSerializer
from .models import Order
from .serializers import OrderSerializer
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from django.http import HttpResponse
from io import BytesIO
import json
from decimal import Decimal

User = get_user_model()

# Vista de login mejorada
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Endpoint de autenticación.
    Espera JSON: {"email": "...", "password": "..."}
    Respuestas:
      200 OK   -> { success: true, user: {...}, tokens: {access, refresh} }
      400 Error de credenciales / datos faltantes
      403 Usuario inactivo
      500 Error interno inesperado
    """
    email = request.data.get('email')
    password = request.data.get('password')

    # Validación campos obligatorios
    if not email or not password:
        return Response({
            'success': False,
            'error': {
                'code': 'missing_fields',
                'message': 'Email y password son requeridos.'
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    # Normalizamos email para búsqueda (case-insensitive)
    email_normalizado = email.strip().lower()

    try:
        user = User.objects.filter(email__iexact=email_normalizado).first()
        if not user:
            return Response({
                'success': False,
                'error': {
                    'code': 'user_not_found',
                    'message': 'Usuario no encontrado.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            return Response({
                'success': False,
                'error': {
                    'code': 'inactive',
                    'message': 'La cuenta está inactiva.'
                }
            }, status=status.HTTP_403_FORBIDDEN)

        if not user.check_password(password):
            return Response({
                'success': False,
                'error': {
                    'code': 'invalid_credentials',
                    'message': 'Credenciales inválidas.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # Credenciales correctas -> generar tokens
        refresh = RefreshToken.for_user(user)
        role_name = user.role.name if getattr(user, 'role', None) else None

        # Setear refresh token en cookie HttpOnly para cross-browser persistence
        response = Response({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'role': role_name
            },
            'tokens': {
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)

        # Cookie segura para refresh token (HttpOnly) — duración según SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
        # Determinar max_age a partir de settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'] si existe
        cookie_max_age = None
        try:
            rt = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME')
            if hasattr(rt, 'total_seconds'):
                cookie_max_age = int(rt.total_seconds())
        except Exception:
            cookie_max_age = 7 * 24 * 60 * 60

        # Escribir cookie HttpOnly. En desarrollo no forzamos secure=True, pero en producción sí.
        # En desarrollo usamos proxy para que las peticiones sean same-site, dejar Lax.
        response.set_cookie(
            key='refresh_token',
            value=str(refresh),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax',
            max_age=cookie_max_age,
            path='/'
        )

        return response

    except Exception as e:
        # Log simple para depuración (evitar exponer detalles sensibles)
        print(f"[login_view] Error inesperado: {e}")
        return Response({
            'success': False,
            'error': {
                'code': 'internal_error',
                'message': 'Error interno del servidor.'
            }
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_from_cookie(request):
    """Endpoint que usa la cookie HttpOnly 'refresh_token' para devolver un nuevo access token."""
    refresh_token = request.COOKIES.get('refresh_token')
    if not refresh_token:
        # No cookie present — return 200 with access: None so frontend can handle without HTTP error
        response = Response({'access': None, 'detail': 'No refresh token cookie'}, status=status.HTTP_200_OK)
        response.delete_cookie('refresh_token', path='/')
        return response

    try:
        refresh = RefreshToken(refresh_token)

        # Intentar obtener el user_id del payload del refresh token y validar existencia/estado
        user_id = None
        try:
            user_id = refresh.payload.get('user_id')
        except Exception:
            try:
                user_id = refresh.get('user_id')
            except Exception:
                user_id = None

        if not user_id:
            response = Response({'access': None, 'detail': 'Refresh token inválido (sin usuario)'}, status=status.HTTP_200_OK)
            response.delete_cookie('refresh_token', path='/')
            return response

        # Validar existencia y estado del usuario antes de devolver access
        try:
            user = User.objects.get(pk=user_id)
            if not getattr(user, 'is_active', True):
                response = Response({'access': None, 'detail': 'Usuario inactivo'}, status=status.HTTP_200_OK)
                response.delete_cookie('refresh_token', path='/')
                return response
        except User.DoesNotExist:
            response = Response({'access': None, 'detail': 'Usuario no encontrado'}, status=status.HTTP_200_OK)
            response.delete_cookie('refresh_token', path='/')
            return response

        # Si el usuario existe y está activo, devolver access token y rol
        new_access = str(refresh.access_token)
        user_role = None
        try:
            user_role = user.role.name if user.role else None
        except Exception:
            user_role = None
        return Response({'access': new_access, 'role': user_role}, status=status.HTTP_200_OK)
    except Exception as e:
        print('[refresh_from_cookie] Error:', e)
        response = Response({'access': None, 'detail': 'Refresh token inválido o error interno'}, status=status.HTTP_200_OK)
        response.delete_cookie('refresh_token', path='/')
        return response


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """Eliminar cookie de refresh en el cliente."""
    response = Response({'detail': 'Logged out'}, status=status.HTTP_200_OK)
    response.delete_cookie('refresh_token', path='/')
    return response

# ViewSet para la gestión de usuarios


class SaleCreate(generics.CreateAPIView):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
class ProductListCreate(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class UserListCreate(generics.ListCreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]  # Permitir creación sin autenticación por ahora
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer
    
class UserDestroy(generics.DestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer

    def get_queryset(self):
        """
        - Gerentes ven a todos los usuarios.
        - Otros usuarios autenticados solo se ven a sí mismos.
        """
        user = self.request.user
        if user.is_authenticated:
            try:
                if user.role and user.role.name == 'Gerente':
                    return User.objects.all()
            except (AttributeError, Role.DoesNotExist):
                return User.objects.filter(pk=user.pk)
            return User.objects.filter(pk=user.pk)
        return User.objects.none()

    def get_permissions(self):
        """
        - `create`, `update`, `partial_update`, `destroy` solo para Gerente.
        - `list`, `retrieve` para cualquier usuario autenticado (la consulta se filtra en get_queryset).
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsGerente]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer
    
    def destroy(self, request, *args, **kwargs):
        # Excepción: un usuario no puede eliminarse a sí mismo
        instance = self.get_object()
        if request.user == instance:
            return Response(
                {"detail": "No puedes eliminar tu propia cuenta."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

# ViewSet para la gestión de productos (CRUD)
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]


class IsEncargado(BasePermission):
    """
    Permiso personalizado para permitir acceso solo a usuarios con el rol 'Encargado'.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and getattr(request.user, 'role', None) and request.user.role.name == 'Encargado'


class IsGerenteOrEncargado(BasePermission):
    """
    Custom permission to only allow users with 'Gerente' or 'Encargado' role.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and hasattr(request.user, 'role') and request.user.role):
            return False
        return request.user.role.name in ['Gerente', 'Encargado']


# ViewSet para compras
class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.all().order_by('-created_at')
    serializer_class = PurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            # Gerente sees all purchases
            if hasattr(user, 'role') and user.role and user.role.name == 'Gerente':
                return Purchase.objects.all()
            # Encargado sees all approved purchases (history) and their own pending ones
            if hasattr(user, 'role') and user.role and user.role.name == 'Encargado':
                from django.db.models import Q
                return Purchase.objects.filter(Q(status='Aprobada') | Q(user=user, status='Pendiente'))
        return Purchase.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsAuthenticated, IsGerenteOrEncargado]
        elif self.action in ['update', 'partial_update', 'destroy', 'approve', 'reject', 'pending_approval']:
            self.permission_classes = [IsAuthenticated, IsGerente]
        else: # list, retrieve, history
            self.permission_classes = [IsAuthenticated, IsGerenteOrEncargado]
        return super().get_permissions()

    def perform_create(self, serializer):
        from django.db import transaction

        user = self.request.user
        role_name = user.role.name if hasattr(user, 'role') and user.role else None

        items = serializer.validated_data.get('items', self.request.data.get('items'))

        computed_total = Decimal('0')
        if items and isinstance(items, list):
            for item in items:
                qty = item.get('quantity', 0)
                price = item.get('price', 0)
                computed_total += Decimal(str(qty)) * Decimal(str(price))

        final_total = serializer.validated_data.get('total_amount') or self.request.data.get('total_amount') or computed_total

        is_manager = role_name == 'Gerente'
        final_status = 'Aprobada' if is_manager else 'Pendiente'
        approved_by = user if is_manager else None
        approved_at = timezone.now() if is_manager else None

        supplier_id = self.request.data.get('supplier_id')
        supplier_name = None
        if supplier_id:
            try:
                supplier = Supplier.objects.get(id=supplier_id)
                supplier_name = supplier.name
            except Supplier.DoesNotExist:
                pass # Se podría manejar un error si el proveedor no existe

        try:
            with transaction.atomic():
                purchase = serializer.save(
                    user=user,
                    total_amount=final_total,
                    status=final_status,
                    approved_by=approved_by,
                    approved_at=approved_at,
                    supplier=supplier_name  # Guardar el nombre del proveedor
                )

                if is_manager and isinstance(purchase.items, list):
                    for item in purchase.items:
                        product_id = item.get('product_id')
                        quantity = item.get('quantity')
                        if product_id and quantity:
                            try:
                                product = Product.objects.select_for_update().get(id=product_id)
                                product.stock += quantity
                                product.save()
                            except Product.DoesNotExist:
                                # This will roll back the transaction
                                raise Exception(f"El producto con ID {product_id} no fue encontrado.")
        except Exception as e:
            raise e

    @action(detail=False, methods=['get'], url_path='pending-approval')
    def pending_approval(self, request):
        """
        Endpoint para que los Gerentes vean todas las solicitudes de compra pendientes.
        """
        pending_purchases = Purchase.objects.filter(status='Pendiente').order_by('-created_at')
        
        page = self.paginate_queryset(pending_purchases)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(pending_purchases, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        """
        Endpoint para que Gerentes y Encargados vean el historial de compras aprobadas y completadas.
        """
        # Gerentes y Encargados pueden ver todas las compras aprobadas y completadas
        from django.db.models import Q
        completed_purchases = Purchase.objects.filter(
            Q(status='Aprobada') | Q(status='Completada')
        ).order_by('-created_at')
        
        page = self.paginate_queryset(completed_purchases)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(completed_purchases, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve a purchase request. Only for 'Gerente'.
        """
        import logging
        logger = logging.getLogger(__name__)

        from django.db import transaction

        purchase = self.get_object()
        logger.info(f'Approving purchase {purchase.id}, current status: {purchase.status}')

        if purchase.status != 'Pendiente':
            return Response({'error': 'This purchase is not pending approval.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Update product stock
                if isinstance(purchase.items, list):
                    for item in purchase.items:
                        try:
                            product_id = item.get('product_id') or item.get('productId')
                            if not product_id:
                                logger.error(f"No product_id found in item: {item}")
                                raise Exception(f"No product_id found in item: {item}")
                            
                            product = Product.objects.get(id=product_id)
                            quantity = item.get('quantity', 0)
                            product.stock += quantity
                            product.save()
                            logger.info(f"Updated product {product.id} stock: +{quantity}, new stock: {product.stock}")
                        except Product.DoesNotExist:
                            logger.error(f"Product with id {product_id} not found during approval of purchase {purchase.id}.")
                            raise Exception(f"Product with id {product_id} not found during approval.")

                purchase.status = 'Aprobada'
                purchase.approved_by = request.user
                purchase.approved_at = timezone.now()
                purchase.save()
                logger.info(f'Purchase {purchase.id} status updated to {purchase.status}')
        except Exception as e:
            logger.error(f'Error during approval process for purchase {purchase.id}: {str(e)}')
            return Response({'error': f'Error during approval process: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(self.get_serializer(purchase).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Reject and delete a purchase request. Only for 'Gerente'.
        """
        purchase = self.get_object()
        if purchase.status != 'Pendiente':
            return Response({'error': 'This purchase is not pending approval.'}, status=status.HTTP_400_BAD_REQUEST)
        
        purchase.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


# ViewSet para pedidos de clientes
class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        try:
            serializer.save(user=self.request.user if self.request.user.is_authenticated else None)
        except Exception as e:
            print(f"[OrderViewSet.perform_create] Error guardando pedido: {e}")
            raise
        # no fallback adicional aquí

# ViewSet para la gestión de movimientos de caja (CRUD)
class CashMovementViewSet(viewsets.ModelViewSet):
    queryset = CashMovement.objects.all()
    serializer_class = CashMovementSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        try:
            # Log minimal info for diagnostics (no token values)
            data = serializer.validated_data
            print(f"[CashMovementViewSet.perform_create] Creating movement user={self.request.user if self.request.user.is_authenticated else 'Anonymous'} type={data.get('type')} amount={data.get('amount')}")
        except Exception as e:
            print(f"[CashMovementViewSet.perform_create] Error reading validated_data: {e}")
        serializer.save(user=self.request.user)

    # Override list to add debug logging for incoming requests
    def list(self, request, *args, **kwargs):
        try:
            has_cookie = 'refresh_token' in request.COOKIES
            print(f"[CashMovementViewSet.list] Request received. user={request.user if request.user.is_authenticated else 'Anonymous'}, refresh_cookie_present={has_cookie}")
        except Exception as e:
            print(f"[CashMovementViewSet.list] Error checking cookies: {e}")
        return super().list(request, *args, **kwargs)

# ViewSet para la gestión de cambios de inventario (CRUD)
class InventoryChangeViewSet(viewsets.ModelViewSet):
    queryset = InventoryChange.objects.all()
    serializer_class = InventoryChangeSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Realizar la operación de cambio de inventario de forma atómica
        from django.db import transaction
        from django.shortcuts import get_object_or_404

        product = serializer.validated_data['product']
        quantity = serializer.validated_data['quantity']
        change_type = serializer.validated_data['type']

        # Enforce server-side permission: solo usuarios con role 'Gerente' pueden crear cambios
        role_name = None
        try:
            role_name = self.request.user.role.name if getattr(self.request.user, 'role', None) else None
        except Exception:
            role_name = None

        if role_name != 'Gerente':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(detail='Permiso denegado: se requiere rol Gerente para modificar inventario')

        with transaction.atomic():
            # Lock the product row to avoid race conditions
            p = Product.objects.select_for_update().get(pk=product.pk)
            previous_stock = p.stock

            if change_type == 'Entrada':
                new_stock = previous_stock + quantity
            else:  # Salida
                if previous_stock < quantity:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({'detail': 'La salida supera el stock disponible.'})
                new_stock = previous_stock - quantity

            # Apply stock change
            p.stock = new_stock
            p.save()

            # Save the InventoryChange record with current user
            inv_change = serializer.save(user=self.request.user)

            # Crear registro de auditoría
            try:
                from .models import InventoryChangeAudit
                InventoryChangeAudit.objects.create(
                    inventory_change=inv_change,
                    product=p,
                    user=self.request.user if self.request.user.is_authenticated else None,
                    role=role_name,
                    change_type=change_type,
                    quantity=quantity,
                    previous_stock=previous_stock,
                    new_stock=new_stock,
                    reason=inv_change.reason if hasattr(inv_change, 'reason') else ''
                )
            except Exception as e:
                print(f"[InventoryChangeViewSet] Error creando audit record: {e}")



# ViewSet para auditoría de cambios de inventario (solo lectura)
class InventoryChangeAuditViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = getattr(__import__('api.models', fromlist=['InventoryChangeAudit']), 'InventoryChangeAudit').objects.all()
    serializer_class = InventoryChangeAuditSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Filtrado opcional por producto, usuario, tipo o rango de fechas
        product_id = self.request.query_params.get('product')
        user_id = self.request.query_params.get('user')
        change_type = self.request.query_params.get('type')
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')

        if product_id:
            qs = qs.filter(product_id=product_id)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if change_type:
            qs = qs.filter(change_type=change_type)
        if start:
            qs = qs.filter(timestamp__gte=start)
        if end:
            qs = qs.filter(timestamp__lte=end)

        return qs

# ViewSet para la gestión de ventas (CRUD)
class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # El serializer ya maneja la lógica de actualización de stock
        try:
            # Log minimal sale info for debugging
            incoming = serializer.validated_data
            total = incoming.get('total_amount')
            items = incoming.get('items')
            print(f"[SaleViewSet.perform_create] Creating sale user={self.request.user.username if self.request.user.is_authenticated else 'Anonymous'} total={total} items_count={len(items) if items else 0}")
        except Exception as e:
            print(f"[SaleViewSet.perform_create] Error reading validated_data: {e}")
        serializer.save(user=self.request.user)
        print(f'🛒 Venta registrada por usuario: {self.request.user.username}')

# ViewSet para la gestión de consultas de usuario
class UserQueryViewSet(viewsets.ModelViewSet):
    queryset = UserQuery.objects.all()
    serializer_class = UserQuerySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo mostrar las consultas del usuario actual
        qs = UserQuery.objects.filter(user=self.request.user)
        # Permitir filtrar por query_type desde query params (por ejemplo: ?query_type=ventas)
        qtype = self.request.query_params.get('query_type')
        if qtype:
            qs = qs.filter(query_type=qtype)
        return qs

    def perform_create(self, serializer):
        # Intentar crear de forma idempotente: si ya existe una consulta para (user, query_type)
        # actualizamos esa entrada en lugar de crear una nueva para evitar IntegrityError por la constraint única.
        qtype = serializer.validated_data.get('query_type')
        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date')
        results_data = serializer.validated_data.get('results_data')

        existing = UserQuery.objects.filter(user=self.request.user, query_type=qtype).first()
        if existing:
            # Desactivar otras consultas del mismo tipo y usuario
            UserQuery.objects.filter(user=self.request.user, query_type=qtype).update(is_active=False)
            # Actualizar fields de la existente y marcar activa
            if start_date is not None:
                existing.start_date = start_date
            if end_date is not None:
                existing.end_date = end_date
            if results_data is not None:
                existing.results_data = results_data
            existing.is_active = True
            existing.save()
            return

        # Si no existe, proceder a crear y asegurar que las previas se desactiven
        UserQuery.objects.filter(user=self.request.user, query_type=qtype).update(is_active=False)
        serializer.save(user=self.request.user, is_active=True)

    @action(detail=False, methods=['get'])
    def active_query(self, request):
        """Obtener la consulta activa del usuario para cualquier tipo"""
        try:
            query = UserQuery.objects.filter(
                user=request.user,
                is_active=True
            ).first()
            
            if query:
                serializer = self.get_serializer(query)
                return Response(serializer.data)
            else:
                return Response({'message': 'No hay consulta activa'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def clear_active_query(self, request):
        """Limpiar la consulta activa del usuario"""
        try:
            UserQuery.objects.filter(
                user=request.user,
                is_active=True
            ).update(is_active=False)
            
            return Response({'message': 'Consulta activa limpiada'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Asegúrate de que ExportDataView esté definida solo aquí y no duplicada en urls.py
class ExportDataView(APIView):
    def post(self, request):
        try:
            data = request.data
            query_type = data.get('query_type')
            query_data = data.get('data', [])
            
            # Debug: imprimir datos recibidos
            print(f"Query type: {query_type}")
            print(f"Data received: {query_data}")
            
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            story = []
            styles = getSampleStyleSheet()
            
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
                alignment=1
            )
            
            # Título más descriptivo
            title = Paragraph(f"Reporte de {query_type.replace('_', ' ').title()}", title_style)
            story.append(title)
            story.append(Spacer(1, 12))
            
            # Verificar si hay datos
            if not query_data:
                no_data_style = ParagraphStyle(
                    'NoData',
                    parent=styles['Normal'],
                    fontSize=12,
                    alignment=1
                )
                story.append(Paragraph("No hay datos disponibles para este reporte.", no_data_style))
            else:
                # Generar tabla según el tipo de consulta
                if query_type in ['inventario', 'stock']:
                    story.append(self._generate_inventory_table(query_data))
                elif query_type == 'ventas':
                    # Si el frontend envió un resumen (summary), renderizarlo arriba
                    summary = data.get('summary') or {}
                    if summary:
                        try:
                            # Crear tres recuadros: Total de Ventas, Ingresos Totales, Período
                            total_sales = int(summary.get('totalSales') or summary.get('total_sales') or 0)
                        except Exception:
                            total_sales = 0
                        try:
                            total_revenue = float(summary.get('totalRevenue') or summary.get('total_revenue') or 0) or 0.0
                        except Exception:
                            total_revenue = 0.0
                        period = summary.get('period') or summary.get('date_range') or ''

                        # Estilo para recuadros
                        box_style = TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.whitesmoke),
                            ('BOX', (0,0), (-1,-1), 1, colors.lightgrey),
                            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                        ])
                        boxes = [
                            [Paragraph(f"<b>Total de Ventas:</b> {total_sales}", styles['Normal']) , ''],
                            [Paragraph(f"<b>Ingresos Totales:</b> ${total_revenue:.2f}", styles['Normal']), ''],
                            [Paragraph(f"<b>Período:</b> {period}", styles['Normal']), '']
                        ]
                        # Convertir cada box a una tabla individual alineada horizontalmente
                        # Usaremos una tabla única con 3 columnas para mostrar los 3 recuadros
                        header_row = ['','', '']
                        box_table = Table([[Paragraph(f"<b>Total de Ventas:</b> {total_sales}", styles['Normal']), Paragraph(f"<b>Ingresos Totales:</b> ${total_revenue:.2f}", styles['Normal']), Paragraph(f"<b>Período:</b> {period}", styles['Normal'])]])
                        box_table.setStyle(TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.lightgrey),
                            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
                            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.white),
                            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                        ]))
                        story.append(box_table)
                        story.append(Spacer(1,12))

                    story.append(self._generate_sales_table(query_data))
                elif query_type in ['usuarios', 'users']:
                    story.append(self._generate_users_table(query_data))
                elif query_type == 'movimientos_caja':
                    story.append(self._generate_cash_movements_table(query_data))
                elif query_type == 'compras':
                    story.append(self._generate_purchases_table(query_data))
                elif query_type == 'pedidos':
                    story.append(self._generate_orders_table(query_data))
                elif query_type in ['proveedores', 'suppliers']:
                    story.append(self._generate_suppliers_table(query_data))
                else:
                    # Tabla genérica para tipos no reconocidos
                    story.append(self._generate_generic_table(query_data))
            
            doc.build(story)
            buffer.seek(0)
            response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="reporte_{query_type}.pdf"'
            return response
        except Exception as e:
            print(f"Error generating PDF: {str(e)}")
            return Response({'error': str(e)}, status=500)
        
        
    def _generate_inventory_table(self, data):
        # Encabezados igual que la interfaz gráfica
        table_data = [['Producto/Insumo', 'Stock', 'Tipo', 'Precio', 'Estado']]
        for item in data:
            precio = item.get('price')
            # Si el precio es None, mostrar vacío, si no, formatear con dos decimales
            if precio is not None:
                try:
                    precio_str = f"${float(precio):.2f}"
                except Exception:
                    precio_str = str(precio)
            else:
                precio_str = ''
            table_data.append([
                item.get('name', ''),
                str(item.get('stock', 0)),
                item.get('type', ''),
                precio_str,
                item.get('status', '')
            ])
            
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_sales_table(self, data):
        # Columns: ID, Fecha, Producto, Cantidad, Total, Usuario
        table_data = [['ID', 'Fecha', 'Producto', 'Cantidad', 'Total', 'Usuario']]
        for item in data:
            # Normalizar campo usuario: puede venir como string, dict u otros formatos
            raw_user = item.get('user') or item.get('username') or item.get('user_name') or ''
            usuario = ''
            try:
                # Si viene como dict (JSON desde frontend), extraer username/name
                if isinstance(raw_user, dict):
                    usuario = raw_user.get('username') or raw_user.get('name') or str(raw_user)
                else:
                    # Si es None o vacío, dejar vacío; si es objeto tipo Decimal/int, convertir a str
                    usuario = str(raw_user) if raw_user is not None else ''
            except Exception:
                usuario = str(raw_user)

            # Formatear total con dos decimales
            total_val = item.get('total', 0)
            try:
                total_num = float(total_val)
            except Exception:
                try:
                    total_num = float(str(total_val).replace('$','').replace(',',''))
                except Exception:
                    total_num = 0.0

            table_data.append([
                str(item.get('id', '')),
                item.get('date', ''),
                item.get('product', ''),
                str(item.get('quantity', 0)),
                f"${total_num:.2f}",
                usuario
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_users_table(self, data):
        table_data = [['Usuario', 'Email', 'Rol']]
        for item in data:
            table_data.append([
                item.get('username', '') or item.get('name', ''),
                item.get('email', ''),
                item.get('role', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_cash_movements_table(self, data):
        styles = getSampleStyleSheet()
        normal_style = styles['Normal']
        normal_style.fontSize = 8
        
        # Encabezados
        headers = ['ID', 'Fecha', 'Tipo', 'Monto', 'Método de Pago', 'Descripción', 'Usuario']
        table_data = [headers]

        for item in data:
            # Obtener y formatear datos de forma segura
            description_text = item.get('description', '')
            user_text = item.get('user') or item.get('user_username') or ''
            payment_method_text = item.get('payment_method') if item.get('payment_method') else 'N/A'
            
            date_str = item.get('date', '')
            if date_str and '.' in date_str:
                date_str = date_str.split('.')[0]

            try:
                amount = float(item.get('amount', 0))
                amount_str = f"${amount:.2f}"
            except (ValueError, TypeError):
                amount_str = str(item.get('amount', ''))

            # Crear Paragraphs para permitir el ajuste de línea
            row = [
                Paragraph(str(item.get('id', '')), normal_style),
                Paragraph(date_str, normal_style),
                Paragraph(item.get('type', ''), normal_style),
                Paragraph(amount_str, normal_style),
                Paragraph(payment_method_text, normal_style),
                Paragraph(description_text, normal_style),
                Paragraph(user_text, normal_style)
            ]
            table_data.append(row)

        # Definir anchos de columna para controlar el desbordamiento
        col_widths = [30, 100, 50, 60, 80, 135, 60]

        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        return table

    def _generate_purchases_table(self, data):
        # Columns: ID, Fecha, Proveedor, Items (nombres), Total, Tipo, Estado
        table_data = [['ID', 'Fecha', 'Proveedor', 'Insumo/Producto', 'Total', 'Tipo', 'Estado']]
        for item in data:
            # items can be a comma-separated string or list
            items_field = item.get('items')
            if isinstance(items_field, (list, tuple)):
                items_str = ', '.join([ (it.get('productName') if isinstance(it, dict) else str(it)) for it in items_field ])
            else:
                items_str = str(items_field or '')

            total_val = item.get('total') if item.get('total', None) is not None else (item.get('totalAmount') if item.get('totalAmount', None) is not None else item.get('total_amount', 0))
            table_data.append([
                item.get('id', ''),
                item.get('date', ''),
                item.get('supplier', ''),
                items_str,
                f"${total_val}",
                item.get('type', ''),
                item.get('status', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_orders_table(self, data):
        # Cambiado: mostrar columna de Productos y columna de Unidades (cantidades por producto)
        table_data = [['ID', 'Fecha', 'Cliente', 'Método de Pago', 'Estado', 'Productos', 'Unidades']]
        for item in data:
            # Soportar diferentes formas de nombrar campos (cliente/customer_name/customerName)
            cliente = item.get('cliente') or item.get('customer_name') or item.get('customerName') or item.get('customer') or ''
            metodo = item.get('metodoPago') or item.get('payment_method') or item.get('paymentMethod') or ''

            items_field = item.get('items')
            products_str = ''
            units_str = ''

            # Si items es una lista de objetos, construir listas de nombres y cantidades
            if isinstance(items_field, (list, tuple)):
                product_names = []
                quantities = []
                for it in items_field:
                    # soportar varias formas de nombrar campos dentro del item
                    name = (it.get('product_name') if isinstance(it, dict) else None) or (it.get('productName') if isinstance(it, dict) else None) or (it.get('product') if isinstance(it, dict) else None) or (it if isinstance(it, str) else '')
                    qty = ''
                    if isinstance(it, dict):
                        q = it.get('quantity') or it.get('qty') or it.get('units') or None
                        qty = str(q) if q is not None else ''
                    product_names.append(name or '')
                    quantities.append(qty)

                products_str = ', '.join([p for p in product_names if p])
                units_str = ', '.join([u for u in quantities if u])
            else:
                # items no es una lista: intentar inferir un número o string
                if isinstance(items_field, (int, float)):
                    products_str = ''
                    units_str = str(items_field)
                else:
                    products_str = str(items_field or '')
                    units_str = ''

            table_data.append([
                item.get('id', ''),
                item.get('date', ''),
                cliente,
                metodo,
                item.get('status', ''),
                products_str,
                units_str
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_suppliers_table(self, data):
        table_data = [['Nombre', 'CUIT', 'Teléfono', 'Dirección', 'Productos']]
        for item in data:
            table_data.append([
                item.get('name', ''),
                item.get('cuit', ''),
                item.get('phone', ''),
                item.get('address', ''),
                item.get('products', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_generic_table(self, data):
        if not data:
            return Paragraph("No hay datos disponibles.")
        
        # Obtener las claves del primer elemento para crear las columnas
        first_item = data[0] if data else {}
        headers = list(first_item.keys())
        
        table_data = [headers]
        for item in data:
            row = [str(item.get(key, '')) for key in headers]
            table_data.append(row)
        
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table