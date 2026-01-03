from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.permissions import SAFE_METHODS, BasePermission
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Product, CashMovement, InventoryChange, Sale, UserQuery, Supplier, Role, LowStockReport, RecipeIngredient, LossRecord, Production, ProductionItem
from .models import ResetToken
from django.conf import settings
from django.utils import timezone
from .serializers import (
    UserSerializer, UserCreateSerializer, ProductSerializer,
    CashMovementSerializer, InventoryChangeSerializer, SaleSerializer,
    UserQuerySerializer, SupplierSerializer, UserStorageSerializer, RoleSerializer, UserUpdateSerializer,
    LowStockReportSerializer, InventoryChangeAuditSerializer, RecipeIngredientSerializer, RecipeIngredientWriteSerializer, LossRecordSerializer,
    ProductionSerializer
)
from .models import UserStorage
from django.db import transaction
from decimal import Decimal
from rest_framework.exceptions import ValidationError
import traceback
import secrets
import hashlib
import urllib.request
import urllib.parse
import json
from datetime import timedelta

# Función de formateo de fecha para replicar el formato del frontend
def format_date_for_pdf(date_input):
    """
    Formatea una fecha para que coincida con el formato del frontend: YYYY/MM/DD HH:mm
    """
    if not date_input:
        return ''
    
    try:
        # Debug: imprimir el valor de entrada para depurar
        print(f"DEBUG - Formatting date: {date_input} (type: {type(date_input)})")
        
        # Si ya es un objeto datetime, lo usamos directamente
        if hasattr(date_input, 'strftime'):
            result = date_input.strftime('%Y/%m/%d %H:%M')
            print(f"DEBUG - Datetime object formatted to: {result}")
            return result
        
        # Si es una cadena, intentamos parsearla
        if isinstance(date_input, str):
            # Limpiar la cadena de entrada
            date_str = date_input.strip()
            
            # Intentamos varios formatos comunes incluyendo ISO 8601
            from datetime import datetime
            formats = [
                '%Y-%m-%dT%H:%M:%S.%fZ',   # ISO 8601 con microsegundos y Z
                '%Y-%m-%dT%H:%M:%S.%f',    # ISO 8601 con microsegundos
                '%Y-%m-%dT%H:%M:%SZ',      # ISO 8601 con Z
                '%Y-%m-%dT%H:%M:%S',       # ISO 8601 básico
                '%Y-%m-%d %H:%M:%S.%f',    # Con microsegundos
                '%Y-%m-%d %H:%M:%S',       # Sin microsegundos
                '%Y-%m-%d',                # Solo fecha
                '%d/%m/%Y %H:%M',          # DD/MM/YYYY HH:MM
                '%d/%m/%Y',                # DD/MM/YYYY
            ]
            
            for fmt in formats:
                try:
                    dt = datetime.strptime(date_str, fmt)
                    result = dt.strftime('%Y/%m/%d %H:%M')
                    print(f"DEBUG - String '{date_str}' parsed with format '{fmt}' and formatted to: {result}")
                    return result
                except ValueError:
                    continue
            
            # Si no se pudo parsear, pero contiene 'T', intentar eliminarla manualmente
            if 'T' in date_str:
                # Reemplazar T por espacio y eliminar Z al final si existe
                cleaned = date_str.replace('T', ' ').rstrip('Z')
                # Eliminar microsegundos si existen
                if '.' in cleaned:
                    cleaned = cleaned.split('.')[0]
                
                try:
                    dt = datetime.strptime(cleaned, '%Y-%m-%d %H:%M:%S')
                    result = dt.strftime('%Y/%m/%d %H:%M')
                    print(f"DEBUG - Manual T replacement: '{cleaned}' formatted to: {result}")
                    return result
                except ValueError:
                    pass
        
        # Si nada funciona, retornamos la entrada como string
        print(f"DEBUG - Could not parse date, returning as string: {date_input}")
        return str(date_input)
        
    except Exception as e:
        print(f"DEBUG - Exception formatting date {date_input}: {e}")
        return str(date_input)

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
    queryset = Supplier.objects.filter(is_active=True)  # Solo proveedores activos
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
    
    def destroy(self, request, *args, **kwargs):
        """Eliminación lógica en lugar de física"""
        from django.utils import timezone
        supplier = self.get_object()
        supplier.is_active = False
        supplier.deleted_at = timezone.now()
        supplier.save()
        return Response({'message': 'Proveedor eliminado correctamente'}, status=status.HTTP_200_OK)

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
        # DEBUG: mostrar información no sensible para rastrear errores 500
        try:
            print(f"[login_view][DEBUG] request.data keys={list(request.data.keys())}")
        except Exception:
            print("[login_view][DEBUG] request.data could not be listed")
        user = User.objects.filter(email__iexact=email_normalizado).first()
        print(f"[login_view][DEBUG] email_normalizado={email_normalizado} user_found={bool(user)}")
        if user:
            try:
                print(f"[login_view][DEBUG] user.id={user.id} is_active={getattr(user, 'is_active', None)} role={getattr(user, 'role', None)}")
                print(f"[login_view][DEBUG] has_failed_login_attempts={hasattr(user, 'failed_login_attempts')} has_is_locked={hasattr(user, 'is_locked')} has_locked_at={hasattr(user, 'locked_at')}")
            except Exception:
                print("[login_view][DEBUG] could not inspect user attributes")
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

        # Verificar si la cuenta está bloqueada (con manejo de campos que pueden no existir)
        try:
            if hasattr(user, 'is_locked') and user.is_locked:
                # Refrescar desde la BD para asegurar que tenemos el valor más reciente
                user.refresh_from_db()
                failed_attempts = getattr(user, 'failed_login_attempts', 5)
                lock_type = getattr(user, 'lock_type', None)
                print(f"🔍 DEBUG - Usuario: {user.username}, is_locked: {user.is_locked}, lock_type RAW: '{lock_type}' (tipo: {type(lock_type)})")
                # Asegurar que lock_type nunca sea None
                if lock_type is None or lock_type == '':
                    print(f"⚠️ lock_type era None/vacío, cambiando a 'automatic'")
                    lock_type = 'automatic'
                print(f"📤 Enviando lock_type al frontend: '{lock_type}'")
                return Response({
                    'success': False,
                    'error': {
                        'code': 'account_locked',
                        'message': 'La cuenta está bloqueada por múltiples intentos fallidos. Contacte al administrador.',
                        'failed_attempts': failed_attempts,
                        'max_attempts': 5,
                        'lock_type': lock_type
                    }
                }, status=status.HTTP_403_FORBIDDEN)
        except AttributeError:
            pass  # Los campos de bloqueo no existen todavía

        if not user.check_password(password):
            # Incrementar intentos fallidos (con manejo de campos que pueden no existir)
            message = 'Credenciales inválidas.'
            failed_attempts = 0
            max_attempts = 5
            
            try:
                if hasattr(user, 'failed_login_attempts'):
                    user.failed_login_attempts = getattr(user, 'failed_login_attempts', 0) + 1
                    failed_attempts = user.failed_login_attempts
                    
                    if user.failed_login_attempts >= max_attempts:
                        if hasattr(user, 'is_locked'):
                            user.is_locked = True
                        if hasattr(user, 'locked_at'):
                            user.locked_at = timezone.now()
                        if hasattr(user, 'lock_type'):
                            user.lock_type = 'automatic'
                    
                    # Construir lista de campos que realmente existen
                    fields_to_update = []
                    if hasattr(user, 'failed_login_attempts'):
                        fields_to_update.append('failed_login_attempts')
                    if hasattr(user, 'is_locked'):
                        fields_to_update.append('is_locked')
                    if hasattr(user, 'locked_at'):
                        fields_to_update.append('locked_at')
                    if hasattr(user, 'lock_type'):
                        fields_to_update.append('lock_type')
                    
                    if fields_to_update:
                        user.save(update_fields=fields_to_update)
                    
                    remaining_attempts = max_attempts - user.failed_login_attempts
                    if remaining_attempts > 0:
                        message = f'Credenciales inválidas. Te quedan {remaining_attempts} intentos.'
                    else:
                        message = 'Cuenta bloqueada por múltiples intentos fallidos. Contacte al administrador.'
            except Exception as e:
                # Si falla, simplemente continuar sin tracking de intentos
                print(f"[login_view] No se pudo actualizar intentos fallidos: {e}")
                message = 'Credenciales inválidas.'
            
            return Response({
                'success': False,
                'error': {
                    'code': 'invalid_credentials',
                    'message': message,
                    'failed_attempts': failed_attempts,
                    'max_attempts': max_attempts
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # Credenciales correctas -> resetear intentos fallidos y generar tokens
        try:
            fields_to_update = []
            if hasattr(user, 'failed_login_attempts') and getattr(user, 'failed_login_attempts', 0) != 0:
                user.failed_login_attempts = 0
                fields_to_update.append('failed_login_attempts')
            if hasattr(user, 'is_locked') and getattr(user, 'is_locked', False):
                user.is_locked = False
                fields_to_update.append('is_locked')
            if hasattr(user, 'locked_at') and getattr(user, 'locked_at', None) is not None:
                user.locked_at = None
                fields_to_update.append('locked_at')
            if fields_to_update:
                user.save(update_fields=fields_to_update)
        except (AttributeError, Exception):
            pass  # Los campos de bloqueo no existen todavía
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
        # Log completo para depuración (no retornar stacktrace al cliente)
        print("[login_view] Error inesperado:")
        traceback.print_exc()
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


def verify_captcha(token, remote_ip=None):
    """
    Verifica un captcha utilizando reCAPTCHA si está configurado en settings.
    Si no existe la configuración y estamos en DEBUG, permite un token especial 'bypass' para pruebas.
    """
    from django.conf import settings
    if not token:
        return False

    # Prefer hCaptcha if configurado, si no probar reCAPTCHA
    hcaptcha_secret = getattr(settings, 'HCAPTCHA_SECRET_KEY', None)
    if hcaptcha_secret:
        try:
            url = 'https://hcaptcha.com/siteverify'
            post_data = urllib.parse.urlencode({
                'secret': hcaptcha_secret,
                'response': token,
                'remoteip': remote_ip
            }).encode('utf-8')
            req = urllib.request.Request(url, data=post_data, method='POST')
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = resp.read().decode('utf-8')
                data = json.loads(body)
                return data.get('success', False)
        except Exception as e:
            print(f"[verify_captcha] Error verifying hCaptcha: {e}")
            return False

    # Si no existe hcaptcha, intentar reCAPTCHA (compatibilidad)
    recaptcha_secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', None)
    if recaptcha_secret:
        try:
            url = 'https://www.google.com/recaptcha/api/siteverify'
            post_data = urllib.parse.urlencode({
                'secret': recaptcha_secret,
                'response': token,
                'remoteip': remote_ip
            }).encode('utf-8')
            req = urllib.request.Request(url, data=post_data, method='POST')
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = resp.read().decode('utf-8')
                data = json.loads(body)
                return data.get('success', False)
        except Exception as e:
            print(f"[verify_captcha] Error verifying recaptcha: {e}")
            return False

    # Si no hay recaptcha configurado, permitir bypass en DEBUG para desarrollo
    if getattr(__import__('django.conf').conf.settings, 'DEBUG', False):
        return token == 'bypass'

    # Por defecto rechazar
    return False


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGerente])
def generate_reset_token(request):
    """
    Genera un token de un solo uso para que un Gerente permita a un usuario resetear su contraseña.
    Request: { "target_email": "user@example.com" }
    Response: { "token": "PLAIN_TOKEN" } (se muestra SOLO una vez)
    """
    target_email = request.data.get('target_email')
    if not target_email:
        return Response({'success': False, 'error': {'code': 'missing_target', 'message': 'Se requiere target_email'}}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=target_email.strip().lower()).first()
    if not user:
        return Response({'success': False, 'error': {'code': 'user_not_found', 'message': 'Usuario no encontrado'}}, status=status.HTTP_400_BAD_REQUEST)

    # Generar token seguro
    token_plain = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token_plain.encode('utf-8')).hexdigest()

    # Crear ResetToken con expiración en 6 minutos
    expires = timezone.now() + timedelta(minutes=6)
    rt = ResetToken.objects.create(
        token_hash=token_hash,
        target_user=user,
        generated_by=request.user,
        expires_at=expires
    )

    # Responder con token en claro SOLO una vez
    return Response({'success': True, 'token': token_plain, 'expires_at': expires.isoformat()}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def generate_reset_token_unauth(request):
    """
    Genera un token de reseteo permitiendo que un Gerente lo cree proporcionando
    sus credenciales en la misma petición. Diseñado para casos donde el Gerente
    no puede iniciar sesión por UI (p.ej. cuenta bloqueada).

    Request: { "gerente_email": "...", "gerente_password": "...", "target_email": "..." }
    Response: { success: True, token: "...", expires_at: "..." }
    """
    gerente_email = request.data.get('gerente_email')
    gerente_password = request.data.get('gerente_password')
    target_email = request.data.get('target_email') or gerente_email

    if not gerente_email or not gerente_password:
        return Response({'success': False, 'error': {'code': 'missing_fields', 'message': 'gerente_email y gerente_password son requeridos.'}}, status=status.HTTP_400_BAD_REQUEST)

    gerente = User.objects.filter(email__iexact=gerente_email.strip().lower()).first()
    if not gerente:
        return Response({'success': False, 'error': {'code': 'gerente_not_found', 'message': 'Gerente no encontrado.'}}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar que es Gerente y contraseña válida
    try:
        role_name = gerente.role.name if getattr(gerente, 'role', None) else None
    except Exception:
        role_name = None

    if role_name != 'Gerente' or not gerente.check_password(gerente_password):
        return Response({'success': False, 'error': {'code': 'invalid_credentials', 'message': 'Credenciales de Gerente inválidas.'}}, status=status.HTTP_400_BAD_REQUEST)

    # Encontrar el usuario objetivo
    user = User.objects.filter(email__iexact=target_email.strip().lower()).first()
    if not user:
        return Response({'success': False, 'error': {'code': 'user_not_found', 'message': 'Usuario objetivo no encontrado.'}}, status=status.HTTP_400_BAD_REQUEST)

    # Generar token (igual que en generate_reset_token)
    token_plain = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token_plain.encode('utf-8')).hexdigest()
    expires = timezone.now() + timedelta(minutes=6)

    ResetToken.objects.create(
        token_hash=token_hash,
        target_user=user,
        generated_by=gerente,
        expires_at=expires
    )

    return Response({'success': True, 'token': token_plain, 'expires_at': expires.isoformat()}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_with_token(request):
    """
    Restablece la contraseña sin requerir captcha ni token de Gerente.
    Request: { email, new_password }
    """
    # Flujo simplificado: solo email y new_password
    email = request.data.get('email')
    new_password = request.data.get('new_password')

    if not email or not new_password:
        return Response({'success': False, 'error': {'code': 'missing_fields', 'message': 'Faltan campos obligatorios: email, new_password.'}}, status=status.HTTP_400_BAD_REQUEST)

    # Buscar usuario por email
    user = User.objects.filter(email__iexact=email.strip().lower()).first()
    if not user:
        # No revelamos si no existe
        return Response({'success': False, 'error': {'code': 'invalid_request', 'message': 'Solicitud inválida.'}}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar que el usuario sea Gerente
    role_name = user.role.name if getattr(user, 'role', None) else None
    if role_name != 'Gerente':
        return Response({'success': False, 'error': {'code': 'not_gerente', 'message': 'Solo los usuarios Gerente pueden cambiar la contraseña.'}}, status=status.HTTP_403_FORBIDDEN)

    # Aplicar nuevo password
    try:
        user.set_password(new_password)
        # Resetear bloqueo
        if hasattr(user, 'failed_login_attempts'):
            user.failed_login_attempts = 0
        if hasattr(user, 'is_locked'):
            user.is_locked = False
        if hasattr(user, 'locked_at'):
            user.locked_at = None
        user.save()
        return Response({'success': True, 'message': 'Contraseña restablecida correctamente.'})
    except Exception as e:
        print(f"[reset_with_token] Error: {e}")
        traceback.print_exc()
        return Response({'success': False, 'error': {'code': 'internal_error', 'message': 'Error interno.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """Eliminar cookie de refresh en el cliente y, si es posible, invalidar (blacklist) el refresh token.

    Comportamiento:
    - Busca el refresh token en cookies (`refresh`, `refresh_token`) o en el body (`refresh`/`refresh_token`).
    - Si existe, intenta crear un `RefreshToken(token)` y llamar a `blacklist()` (funciona si `rest_framework_simplejwt.token_blacklist` está instalado).
    - Elimina las cookies que pueda y responde con éxito.
    """
    # Intentar obtener el refresh token desde cookies o body
    token = None
    token = request.COOKIES.get('refresh') or request.COOKIES.get('refresh_token') or request.data.get('refresh') or request.data.get('refresh_token')

    if token:
        try:
            rt = RefreshToken(token)
            # Si el método blacklist existe (token_blacklist instalado), invocarlo
            if hasattr(rt, 'blacklist'):
                rt.blacklist()
        except Exception:
            # No hay blacklisting disponible o token inválido: ignorar y continuar con borrado de cookies
            pass

    response = Response({'detail': 'Logged out'}, status=status.HTTP_200_OK)
    # Eliminar cookies de sesión/refresh/access para evitar que otras pestañas vuelvan a autenticar
    cookies_to_delete = ['refresh', 'refresh_token', 'jwt', 'access', 'access_token']
    for c in cookies_to_delete:
        try:
            response.delete_cookie(c, path='/')
        except Exception:
            # ignore failures deleting non-existent cookies
            pass

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
        - Gerentes ven a todos los usuarios activos.
        - Otros usuarios autenticados solo se ven a sí mismos si están activos.
        """
        user = self.request.user
        if user.is_authenticated:
            try:
                if user.role and user.role.name == 'Gerente':
                    return User.objects.filter(is_active=True)  # Solo usuarios activos
            except (AttributeError, Role.DoesNotExist):
                return User.objects.filter(pk=user.pk, is_active=True)
            return User.objects.filter(pk=user.pk, is_active=True)
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
        
        # Eliminación lógica en lugar de física
        instance.is_active = False
        instance.save()
        return Response({'message': 'Usuario desactivado correctamente'}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[IsGerente])
    def unlock(self, request, pk=None):
        """
        Desbloquea un usuario que ha sido bloqueado por intentos fallidos de login.
        Solo accesible por Gerentes.
        """
        user = self.get_object()
        user.is_locked = False
        user.failed_login_attempts = 0
        user.locked_at = None
        user.lock_type = None
        user.save(update_fields=['is_locked', 'failed_login_attempts', 'locked_at', 'lock_type'])
        print(f"🔓 Usuario desbloqueado: {user.username}, is_locked={user.is_locked}, lock_type={user.lock_type}")
        return Response({
            'message': f'Usuario {user.username} desbloqueado correctamente.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[IsGerente])
    def lock(self, request, pk=None):
        """
        Bloquea manualmente un usuario.
        Solo accesible por Gerentes.
        """
        user = self.get_object()
        user.is_locked = True
        user.locked_at = timezone.now()
        user.lock_type = 'manual'
        user.save(update_fields=['is_locked', 'locked_at', 'lock_type'])
        print(f"🔒 Usuario bloqueado: {user.username}, lock_type={user.lock_type}")
        return Response({
            'message': f'Usuario {user.username} bloqueado correctamente.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)

# ViewSet para la gestión de productos (CRUD)
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True)  # Solo productos activos
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    
    def destroy(self, request, *args, **kwargs):
        """Eliminación lógica en lugar de física"""
        from django.utils import timezone
        product = self.get_object()
        product.is_active = False
        product.deleted_at = timezone.now()
        product.save()
        return Response({'message': 'Producto eliminado correctamente'}, status=status.HTTP_200_OK)
    
    def update(self, request, *args, **kwargs):
        # Permitir tanto PUT (completo) como PATCH (parcial)
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        # Manejar partial_update (PATCH) correctamente
        return super().partial_update(request, *args, **kwargs)
    
    @action(detail=True, methods=['patch', 'put'])
    def update_loss_rate(self, request, pk=None):
        """Endpoint específico para actualizar solo loss_rate"""
        product = self.get_object()
        loss_rate = request.data.get('loss_rate')
        
        if loss_rate is not None:
            try:
                loss_rate = float(loss_rate)
                if loss_rate < 0 or loss_rate > 1:
                    return Response({'error': 'La tasa de pérdida debe estar entre 0.0 y 1.0'}, status=400)
                
                # Forzar actualización usando update() para asegurar persistencia
                Product.objects.filter(id=product.id).update(loss_rate=loss_rate)
                
                # Recargar el objeto para verificar que se guardó
                product.refresh_from_db()
                
                # Verificar que el valor se guardó correctamente
                if abs(product.loss_rate - loss_rate) > 0.0001:
                    return Response({'error': 'Error al guardar la tasa de pérdida'}, status=500)
                
                serializer = self.get_serializer(product)
                return Response(serializer.data, status=200)
                
            except (ValueError, TypeError):
                return Response({'error': 'Valor de tasa de pérdida inválido'}, status=400)
        
        return Response({'error': 'Se requiere el campo loss_rate'}, status=400)

    @action(detail=True, methods=['patch', 'put'])
    def update_recipe_yield(self, request, pk=None):
        """Endpoint específico para actualizar solo recipe_yield"""
        product = self.get_object()
        recipe_yield = request.data.get('recipe_yield')
        
        if recipe_yield is not None:
            try:
                recipe_yield = int(recipe_yield)
                if recipe_yield < 1:
                    return Response({'error': 'El rendimiento debe ser al menos 1'}, status=400)
                
                product.recipe_yield = recipe_yield
                product.save()
                
                # Recargar desde la BD para asegurar que se guardó
                product.refresh_from_db()
                print(f"ENDPOINT update_recipe_yield - Después de refresh: {product.recipe_yield}")
                
                serializer = self.get_serializer(product)
                return Response(serializer.data)
            except ValueError:
                return Response({'error': 'Valor inválido para recipe_yield'}, status=400)
        
        return Response({'error': 'recipe_yield requerido'}, status=400)
    
    @action(detail=True, methods=['get'])
    def diagnose_recipe_yield(self, request, pk=None):
        """Endpoint de diagnóstico para recipe_yield"""
        from django.db import connection
        
        product = self.get_object()
        
        # Consulta directa a la BD
        with connection.cursor() as cursor:
            cursor.execute("SELECT recipe_yield FROM api_product WHERE id = %s", [pk])
            db_value = cursor.fetchone()[0] if cursor.rowcount > 0 else None
        
        return Response({
            'product_id': product.id,
            'instance_recipe_yield': product.recipe_yield,
            'db_recipe_yield': db_value,
            'serializer_data': self.get_serializer(product).data
        })


class RecipeIngredientViewSet(viewsets.ModelViewSet):
    serializer_class = RecipeIngredientSerializer
    queryset = RecipeIngredient.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return RecipeIngredientWriteSerializer
        return RecipeIngredientSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset

    def perform_create(self, serializer):
        # Obtener el product_id de los datos de la request
        product_id = self.request.data.get('product')
        serializer.save(product_id=product_id)

# Vista específica para obtener ingredientes con unidad sugerida para recetas
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_ingredients_with_suggested_unit(request):
    """
    Retorna ingredientes disponibles con unidad sugerida automáticamente.
    Si el producto no tiene la unidad correcta, la corrige automáticamente.
    """
    try:
        ingredients = Product.objects.filter(is_ingredient=True, stock__gt=0)
        
        def get_smart_unit(name, current_unit):
            """Determina la unidad más apropiada basándose en el nombre del ingrediente"""
            name_lower = name.lower()
            
            # Excepciones específicas (gramos)
            if 'dulce de leche' in name_lower or 'dulce leche' in name_lower:
                return 'g'
            
            # Líquidos (mililitros)
            if (('leche' in name_lower and 'dulce' not in name_lower) or 
                'agua' in name_lower or 'aceite' in name_lower or 
                'vinagre' in name_lower or 'crema' in name_lower or
                'jugo' in name_lower or 'ml' in name_lower or 'litro' in name_lower):
                return 'ml'
            
            # Unidades individuales
            if ('huevo' in name_lower or 'sobre' in name_lower or 
                'cubo' in name_lower or 'unidad' in name_lower):
                return 'unidades'
            
            # Si ya tiene una unidad válida, mantenerla
            if current_unit in ['g', 'ml', 'unidades']:
                return current_unit
                
            # Por defecto, gramos
            return 'g'
        
        ingredients_data = []
        for ingredient in ingredients:
            smart_unit = get_smart_unit(ingredient.name, ingredient.unit)
            
            ingredients_data.append({
                'id': ingredient.id,
                'name': ingredient.name,
                'stock': float(ingredient.stock),
                'unit': ingredient.unit,
                'suggested_unit': smart_unit
            })
        
        return Response({
            'success': True,
            'data': ingredients_data
        })
    except Exception as e:
        return Response({
            'success': False,
            'error': f'Error al obtener ingredientes: {str(e)}'
        }, status=500)

class IsGerenteOrEncargadoForLoss(BasePermission):
    """
    Permite acceso solo a usuarios con rol Gerente o Encargado para gestión de pérdidas.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role and request.user.role.name in ['Gerente', 'Encargado']

# ViewSet para registros de pérdidas
class LossRecordViewSet(viewsets.ModelViewSet):
    serializer_class = LossRecordSerializer
    permission_classes = [IsAuthenticated, IsGerenteOrEncargadoForLoss]

    def get_queryset(self):
        return LossRecord.objects.all().order_by('-timestamp')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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
    queryset = Purchase.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = PurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            # Gerente sees all active purchases
            if hasattr(user, 'role') and user.role and user.role.name == 'Gerente':
                return Purchase.objects.filter(is_active=True)
            # Encargado sees all approved purchases (history) and their own pending ones
            if hasattr(user, 'role') and user.role and user.role.name == 'Encargado':
                from django.db.models import Q
                return Purchase.objects.filter(
                    Q(status='Aprobada', is_active=True) | 
                    Q(user=user, status='Pendiente', is_active=True)
                )
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
                price = item.get('unitPrice', 0)
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
                        product_name = item.get('productName')
                        try:
                            quantity = Decimal(str(item.get('quantity', '0')))
                            unit_price = Decimal(str(item.get('unitPrice', '0')))
                        except:
                            continue
                        
                        purchase_unit = item.get('unit', '').lower()

                        if quantity <= 0:
                            continue

                        product = None
                        if product_id:
                            try:
                                product = Product.objects.select_for_update().get(id=product_id)
                            except Product.DoesNotExist:
                                raise Exception(f"El producto con ID {product_id} no fue encontrado.")
                        elif product_name:
                            base_unit_for_new_product = 'u'
                            if purchase_unit in ['kg', 'g']:
                                base_unit_for_new_product = 'g'
                            elif purchase_unit in ['l', 'ml']:
                                base_unit_for_new_product = 'ml'

                            product, created = Product.objects.select_for_update().get_or_create(
                                name=product_name,
                                defaults={
                                    'price': unit_price,
                                    'stock': 0,
                                    'category': 'Insumo',
                                    'unit': base_unit_for_new_product,
                                    'is_ingredient': True
                                }
                            )
                        
                        if not product:
                            continue

                        if not purchase_unit:
                            purchase_unit = product.unit.lower()

                        base_quantity = quantity
                        product_base_unit = product.unit.lower()

                        # Conversión de unidades de compra a unidad base del producto
                        if product_base_unit == 'g':
                            if purchase_unit == 'kg':
                                base_quantity = quantity * 1000
                            elif purchase_unit != 'g':
                                raise ValueError(f"Unidad de compra '{purchase_unit}' inválida para el producto '{product.name}' (unidad base: 'g').")
                        elif product_base_unit == 'ml':
                            if purchase_unit == 'l':
                                base_quantity = quantity * 1000
                            elif purchase_unit != 'ml':
                                raise ValueError(f"Unidad de compra '{purchase_unit}' inválida para el producto '{product.name}' (unidad base: 'ml').")
                        elif product_base_unit == 'u':
                            if purchase_unit != 'u':
                                raise ValueError(f"Unidad de compra '{purchase_unit}' inválida para el producto '{product.name}' (unidad base: 'u').")
                        elif purchase_unit != product_base_unit:
                                raise ValueError(f"No se puede convertir de '{purchase_unit}' a '{product_base_unit}' para el producto '{product.name}'.")

                        product.stock += base_quantity
                        product.save()
        except Exception as e:
            raise e

    @action(detail=False, methods=['get'], url_path='pending-approval')
    def pending_approval(self, request):
        """
        Endpoint para que los Gerentes vean todas las solicitudes de compra pendientes.
        """
        pending_purchases = Purchase.objects.filter(status='Pendiente', is_active=True).order_by('-created_at')
        
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
            Q(status='Aprobada', is_active=True) | Q(status='Completada', is_active=True)
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
                            product_name = item.get('productName')
                            try:
                                quantity = Decimal(str(item.get('quantity', '0')))
                                unit_price = Decimal(str(item.get('unitPrice', '0')))
                            except:
                                logger.warning(f"Invalid quantity or price for item {item} in purchase {purchase.id}. Skipping.")
                                continue
                            
                            purchase_unit = item.get('unit', '').lower()

                            if quantity <= 0:
                                continue

                            product = None
                            if product_id:
                                product = Product.objects.select_for_update().get(id=product_id)
                            elif product_name:
                                base_unit_for_new_product = 'u'
                                if purchase_unit in ['kg', 'g']:
                                    base_unit_for_new_product = 'g'
                                elif purchase_unit in ['l', 'ml']:
                                    base_unit_for_new_product = 'ml'

                                product, created = Product.objects.select_for_update().get_or_create(
                                    name=product_name,
                                    defaults={
                                        'price': unit_price,
                                        'stock': 0,
                                        'category': 'Insumo',
                                        'unit': base_unit_for_new_product,
                                        'is_ingredient': True
                                    }
                                )
                            
                            if not product:
                                continue

                            if not purchase_unit:
                                purchase_unit = product.unit.lower()

                            base_quantity = quantity
                            product_base_unit = product.unit.lower()

                            # Conversión de unidades de compra a unidad base del producto
                            if product_base_unit == 'g':
                                if purchase_unit == 'kg':
                                    base_quantity = quantity * 1000
                                elif purchase_unit != 'g':
                                    raise ValueError(f"Unidad de compra '{purchase_unit}' inválida para el producto '{product.name}' (unidad base: 'g').")
                            elif product_base_unit == 'ml':
                                if purchase_unit == 'l':
                                    base_quantity = quantity * 1000
                                elif purchase_unit != 'ml':
                                    raise ValueError(f"Unidad de compra '{purchase_unit}' inválida para el producto '{product.name}' (unidad base: 'ml').")
                            elif product_base_unit == 'u':
                                if purchase_unit != 'u':
                                    raise ValueError(f"Unidad de compra '{purchase_unit}' inválida para el producto '{product.name}' (unidad base: 'u').")
                            elif purchase_unit != product_base_unit:
                                    raise ValueError(f"No se puede convertir de '{purchase_unit}' a '{product_base_unit}' para el producto '{product.name}'.")

                            product.stock += base_quantity
                            product.save()
                            logger.info(f"Updated product {product.id} stock: +{base_quantity} ({quantity} {purchase_unit}), new stock: {product.stock}")
                        
                        except Product.DoesNotExist:
                            logger.error(f"Product with id {item.get('product_id')} not found during approval of purchase {purchase.id}.")
                            raise Exception(f"Product with id {item.get('product_id')} not found during approval.")
                        except ValueError as e:
                            logger.error(f"Error processing item {item} in purchase {purchase.id}: {str(e)}")
                            raise e

                purchase.status = 'Aprobada'
                purchase.approved_by = request.user
                purchase.approved_at = timezone.now()
                purchase.save()
                logger.info(f'Purchase {purchase.id} status updated to {purchase.status}')
        except Exception as e:
            logger.error(f'Error during approval process for purchase {purchase.id}: {str(e)}')
            return Response({'error': f'Error during approval process: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(self.get_serializer(purchase).data)

    def destroy(self, request, *args, **kwargs):
        """
        Implementa eliminación lógica para compras
        """
        instance = self.get_object()
        instance.is_active = False
        instance.deleted_at = timezone.now()
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Reject a purchase request using logical deletion. Only for 'Gerente'.
        """
        purchase = self.get_object()
        if purchase.status != 'Pendiente':
            return Response({'error': 'This purchase is not pending approval.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Usar eliminación lógica en lugar de eliminar físicamente
        purchase.is_active = False
        purchase.deleted_at = timezone.now()
        purchase.save()
        
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
               
                # Validar que la cantidad sea un número entero si el producto no es un insumo
                if not p.is_ingredient and quantity % 1 != 0:
                        from rest_framework.exceptions import ValidationError
                        raise ValidationError({'detail': 'La cantidad para productos no insumos debe ser un número entero.'})

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


# ViewSet para registros de producción
class ProductionViewSet(viewsets.ModelViewSet):
    serializer_class = __import__('api.serializers', fromlist=['ProductionSerializer']).ProductionSerializer
    permission_classes = [IsAuthenticated, IsGerente]
    
    def get_queryset(self):
        Production = __import__('api.models', fromlist=['Production']).Production
        return Production.objects.prefetch_related('items__product').all()

    @action(detail=False, methods=['post'], url_path='batch')
    def batch_create(self, request):
        """
        Endpoint para crear múltiples producciones en lote.
        Formato esperado:
        {
            "productions": [
                {"product_id": 1, "quantity_produced": 10},
                {"product_id": 2, "quantity_produced": 5}
            ]
        }
        """
        productions_data = request.data.get('productions', [])
        
        if not productions_data:
            return Response(
                {'error': 'No se proporcionaron producciones'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        Production = __import__('api.models', fromlist=['Production']).Production
        ProductionItem = __import__('api.models', fromlist=['ProductionItem']).ProductionItem
        Product = __import__('api.models', fromlist=['Product']).Product
        RecipeIngredient = __import__('api.models', fromlist=['RecipeIngredient']).RecipeIngredient

        try:
            with transaction.atomic():
                # Crear el registro de producción principal
                total_units = sum(item.get('quantity_produced', 0) for item in productions_data)
                production = Production.objects.create(
                    user=request.user,
                    total_units=total_units
                )

                # Contador para verificar que se crea al menos un item
                items_created = 0
                
                # Listas para rastrear cambios en inventario
                ingredients_changes = {}  # Para insumos usados totales (agregados por nombre)
                products_changes = []  # Para productos creados con sus insumos específicos

                # Crear los items individuales y actualizar stock
                for item_data in productions_data:
                    product_id = item_data.get('product_id')
                    quantity = item_data.get('quantity_produced', 0)

                    if not product_id or quantity <= 0:
                        continue

                    try:
                        product = Product.objects.get(id=product_id)
                        
                        # Obtener la receta del producto
                        recipe_ingredients = RecipeIngredient.objects.filter(product=product)
                        
                        # Función para formatear cantidad según unidad
                        def format_quantity_with_unit(quantity, unit):
                            quantity = Decimal(str(quantity))
                            if unit == 'g':
                                # Convertir gramos a kilogramos
                                kg = quantity / 1000
                                return f"{kg:.2f} Kg"
                            elif unit == 'ml':
                                # Convertir mililitros a litros
                                liters = quantity / 1000
                                return f"{liters:.2f} L"
                            elif unit == 'u':
                                # Unidades
                                return f"{quantity:.0f} U"
                            else:
                                # Por defecto, mostrar sin conversión
                                return f"{quantity:.2f} {unit}"
                        
                        # Verificar que hay suficientes insumos antes de producir
                        insufficient_ingredients = []
                        for recipe_item in recipe_ingredients:
                            ingredient = recipe_item.ingredient
                            # Calcular cantidad necesaria considerando el rendimiento de la receta
                            recipe_yield = product.recipe_yield if product.recipe_yield else 1
                            quantity_needed = (Decimal(str(recipe_item.quantity)) * Decimal(str(quantity))) / Decimal(str(recipe_yield))
                            
                            if ingredient.stock < quantity_needed:
                                # Agregar a la lista de insuficientes
                                needed_formatted = format_quantity_with_unit(quantity_needed, recipe_item.unit)
                                available_formatted = format_quantity_with_unit(ingredient.stock, recipe_item.unit)
                                insufficient_ingredients.append(
                                    f"{ingredient.name}: Necesario {needed_formatted}, Disponible {available_formatted}"
                                )
                        
                        # Si hay insumos insuficientes, devolver error con todos los detalles
                        if insufficient_ingredients:
                            error_message = "Stock insuficiente de los siguientes insumos:\n" + "\n".join(insufficient_ingredients)
                            return Response(
                                {'error': error_message},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                        
                        # Guardar stock previo del producto antes de actualizar
                        product_stock_before = Decimal(str(product.stock))
                        
                        # Lista de insumos usados para ESTE producto específico
                        product_ingredients_used = []
                        
                        # Descontar insumos de la receta
                        for recipe_item in recipe_ingredients:
                            ingredient = recipe_item.ingredient
                            recipe_yield = product.recipe_yield if product.recipe_yield else 1
                            quantity_needed = (Decimal(str(recipe_item.quantity)) * Decimal(str(quantity))) / Decimal(str(recipe_yield))
                            
                            # Guardar stock previo del ingrediente
                            ingredient_stock_before = Decimal(str(ingredient.stock))
                            
                            # Descontar del stock del ingrediente
                            ingredient.stock = Decimal(str(ingredient.stock)) - quantity_needed
                            ingredient.save()
                            
                            # Información del ingrediente usado para ESTE producto
                            ingredient_info = {
                                'name': ingredient.name,
                                'quantity_used': float(quantity_needed),
                                'unit': recipe_item.unit,
                                'formatted_used': format_quantity_with_unit(quantity_needed, recipe_item.unit)
                            }
                            product_ingredients_used.append(ingredient_info)
                            
                            # Acumular en el diccionario de totales
                            if ingredient.name not in ingredients_changes:
                                ingredients_changes[ingredient.name] = {
                                    'name': ingredient.name,
                                    'stock_before': float(ingredient_stock_before),
                                    'quantity_used': float(quantity_needed),
                                    'stock_after': float(ingredient.stock),
                                    'unit': recipe_item.unit,
                                    'formatted_before': format_quantity_with_unit(ingredient_stock_before, recipe_item.unit),
                                    'formatted_used': format_quantity_with_unit(quantity_needed, recipe_item.unit),
                                    'formatted_after': format_quantity_with_unit(ingredient.stock, recipe_item.unit)
                                }
                            else:
                                # Si ya existe, sumar la cantidad usada
                                ingredients_changes[ingredient.name]['quantity_used'] += float(quantity_needed)
                                ingredients_changes[ingredient.name]['stock_after'] = float(ingredient.stock)
                                ingredients_changes[ingredient.name]['formatted_used'] = format_quantity_with_unit(
                                    ingredients_changes[ingredient.name]['quantity_used'], 
                                    recipe_item.unit
                                )
                                ingredients_changes[ingredient.name]['formatted_after'] = format_quantity_with_unit(
                                    ingredient.stock, 
                                    recipe_item.unit
                                )
                        
                        # Crear el item de producción
                        ProductionItem.objects.create(
                            production=production,
                            product=product,
                            quantity=quantity
                        )
                        items_created += 1

                        # Actualizar el stock del producto
                        product.stock = Decimal(str(product.stock)) + Decimal(str(quantity))
                        product.save()
                        
                        # Registrar el cambio en el producto CON sus insumos específicos
                        products_changes.append({
                            'name': product.name,
                            'stock_before': float(product_stock_before),
                            'quantity_produced': float(quantity),
                            'stock_after': float(product.stock),
                            'unit': 'u',
                            'ingredients_used': product_ingredients_used  # Insumos específicos de este producto
                        })

                    except Product.DoesNotExist:
                        return Response(
                            {'error': f'Producto con ID {product_id} no encontrado'},
                            status=status.HTTP_404_NOT_FOUND
                        )

                # Validar que se haya creado al menos un item
                if items_created == 0:
                    return Response(
                        {'error': 'No se crearon items de producción. Verifique que los productos y cantidades sean válidos.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Retornar el registro creado con información detallada de cambios
                serializer = self.get_serializer(production)
                response_data = serializer.data
                response_data['changes'] = {
                    'ingredients': list(ingredients_changes.values()),  # Convertir diccionario a lista
                    'products': products_changes
                }
                return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': f'Error al crear la producción: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
                    # Agregar resumen para stock si está disponible
                    summary = data.get('summary') or {}
                    if summary:
                        try:
                            total_products = int(summary.get('totalProducts') or 0)
                            total_insumos = int(summary.get('totalInsumos') or 0)
                            low_stock_items = int(summary.get('lowStockItems') or 0)
                            total_stock = str(summary.get('totalStock') or '')
                        except Exception:
                            total_products = 0
                            total_insumos = 0
                            low_stock_items = 0
                            total_stock = ''

                        # Crear tabla de resumen para stock
                        summary_data = [
                            [Paragraph(f"<b>Total Products:</b> {total_products}", styles['Normal']), 
                             Paragraph(f"<b>Total Insumos:</b> {total_insumos}", styles['Normal'])],
                            [Paragraph(f"<b>Low Stock Items:</b> {low_stock_items}", styles['Normal']),
                             Paragraph(f"<b>Total Stock:</b> {total_stock}", styles['Normal'])]
                        ]
                        summary_table = Table(summary_data)
                        summary_table.setStyle(TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.lightgrey),
                            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
                            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.white),
                            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                            ('FONTSIZE', (0,0), (-1,-1), 10),
                        ]))
                        story.append(summary_table)
                        story.append(Spacer(1,12))
                    
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
                    # Agregar resumen para movimientos de caja
                    summary = data.get('summary') or {}
                    if summary:
                        try:
                            total_movements = int(summary.get('totalMovements') or 0)
                            total_income = str(summary.get('totalIncome') or '0.00')
                            total_expenses = str(summary.get('totalExpenses') or '0.00')
                            period = str(summary.get('period') or '')
                        except Exception:
                            total_movements = 0
                            total_income = '0.00'
                            total_expenses = '0.00'
                            period = ''

                        # Crear tabla de resumen para movimientos de caja
                        summary_data = [
                            [Paragraph(f"<b>Total de Movimientos:</b> {total_movements}", styles['Normal']), 
                             Paragraph(f"<b>Ingresos Totales:</b> ${total_income}", styles['Normal'])],
                            [Paragraph(f"<b>Gastos Totales:</b> ${total_expenses}", styles['Normal']),
                             Paragraph(f"<b>Período:</b> {period}", styles['Normal'])]
                        ]
                        summary_table = Table(summary_data)
                        summary_table.setStyle(TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.lightgrey),
                            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
                            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.white),
                            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                            ('FONTSIZE', (0,0), (-1,-1), 10),
                        ]))
                        story.append(summary_table)
                        story.append(Spacer(1,12))
                    
                    story.append(self._generate_cash_movements_table(query_data))
                elif query_type == 'compras':
                    # Agregar resumen para compras
                    summary = data.get('summary') or {}
                    if summary:
                        try:
                            total_purchases = int(summary.get('totalPurchases') or 0)
                            total_amount = float(summary.get('totalAmount') or 0)
                            period = str(summary.get('period') or '')
                        except Exception:
                            total_purchases = 0
                            total_amount = 0.0
                            period = ''

                        # Crear tabla de resumen para compras
                        summary_data = [
                            [Paragraph(f"<b>Total de Compras:</b> {total_purchases}", styles['Normal']), 
                             Paragraph(f"<b>Monto Total:</b> ${total_amount:.2f}", styles['Normal'])],
                            [Paragraph(f"<b>Período:</b> {period}", styles['Normal']), '']
                        ]
                        summary_table = Table(summary_data)
                        summary_table.setStyle(TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.lightgrey),
                            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
                            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.white),
                            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                            ('FONTSIZE', (0,0), (-1,-1), 10),
                        ]))
                        story.append(summary_table)
                        story.append(Spacer(1,12))
                    
                    story.append(self._generate_purchases_table(query_data))
                elif query_type == 'pedidos':
                    # Agregar resumen para pedidos
                    summary = data.get('summary') or {}
                    if summary:
                        try:
                            total_orders = int(summary.get('totalOrders') or 0)
                            pending_orders = int(summary.get('pendingOrders') or 0)
                            sent_orders = int(summary.get('sentOrders') or 0)
                            period = str(summary.get('period') or '')
                        except Exception:
                            total_orders = 0
                            pending_orders = 0
                            sent_orders = 0
                            period = ''

                        # Crear tabla de resumen para pedidos
                        summary_data = [
                            [Paragraph(f"<b>Total de Pedidos:</b> {total_orders}", styles['Normal']), 
                             Paragraph(f"<b>Pedidos Pendientes:</b> {pending_orders}", styles['Normal'])],
                            [Paragraph(f"<b>Pedidos Enviados:</b> {sent_orders}", styles['Normal']),
                             Paragraph(f"<b>Período:</b> {period}", styles['Normal'])]
                        ]
                        summary_table = Table(summary_data)
                        summary_table.setStyle(TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.lightgrey),
                            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
                            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.white),
                            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                            ('FONTSIZE', (0,0), (-1,-1), 10),
                        ]))
                        story.append(summary_table)
                        story.append(Spacer(1,12))
                    
                    story.append(self._generate_orders_table(query_data))
                elif query_type in ['proveedores', 'suppliers']:
                    # Agregar resumen para proveedores
                    summary = data.get('summary') or {}
                    if summary:
                        try:
                            total_suppliers = int(summary.get('totalSuppliers') or 0)
                            active_suppliers = int(summary.get('activeSuppliers') or 0)
                        except Exception:
                            total_suppliers = 0
                            active_suppliers = 0

                        # Crear tabla de resumen para proveedores
                        summary_data = [
                            [Paragraph(f"<b>Total de Proveedores:</b> {total_suppliers}", styles['Normal']), 
                             Paragraph(f"<b>Proveedores Activos:</b> {active_suppliers}", styles['Normal'])]
                        ]
                        summary_table = Table(summary_data)
                        summary_table.setStyle(TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.lightgrey),
                            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
                            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.white),
                            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                            ('FONTSIZE', (0,0), (-1,-1), 10),
                        ]))
                        story.append(summary_table)
                        story.append(Spacer(1,12))
                    
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
        # Encabezados igual que la interfaz gráfica, incluyendo ID
        table_data = [['ID', 'Producto/Insumo', 'Stock', 'Tipo', 'Precio', 'Estado']]
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
                str(item.get('id', '')),
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

            # Procesar fecha de la misma manera que en movimientos de caja
            date_str = item.get('date', '')
            if date_str and '.' in date_str:
                date_str = date_str.split('.')[0]
            
            # Formatear fecha para que coincida con la interfaz gráfica
            formatted_date = format_date_for_pdf(date_str)

            table_data.append([
                str(item.get('id', '')),
                formatted_date,
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

            # Formatear fecha para que coincida con la interfaz gráfica
            formatted_date = format_date_for_pdf(date_str)

            # Crear Paragraphs para permitir el ajuste de línea
            row = [
                Paragraph(str(item.get('id', '')), normal_style),
                Paragraph(formatted_date, normal_style),
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
        from .models import Product
        
        # Columns: ID, Fecha, Proveedor, Items (nombres), Total, Tipo (sin columna Estado)
        table_data = [['ID', 'Fecha', 'Proveedor', 'Insumo/Producto', 'Total', 'Tipo']]
        for item in data:
            # items can be a comma-separated string or list
            items_field = item.get('items')
            items_str = ''
            
            if isinstance(items_field, (list, tuple)):
                # Procesar items con cantidades y unidades simples
                formatted_items = []
                for it in items_field:
                    if isinstance(it, dict):
                        product_name = it.get('productName') or it.get('product_name') or it.get('product') or it.get('name') or ''
                        quantity = it.get('quantity', 0)
                        
                        # Limpiar el product_name si contiene multiplicaciones
                        if ' x ' in product_name or ' = ' in product_name:
                            # Extraer solo el nombre del producto antes de cualquier multiplicación
                            product_name = product_name.split(' x ')[0].split(' = ')[0].strip()
                        
                        if product_name and quantity and quantity > 0:
                            try:
                                # Buscar el producto en la base de datos para obtener su unidad
                                product = Product.objects.filter(name__iexact=product_name).first()
                                if product:
                                    unit = product.unit
                                    # Formatear según la unidad directamente
                                    if unit == 'g':
                                        formatted_items.append(f"{product_name} {int(quantity)}Kg")
                                    elif unit == 'ml':
                                        formatted_items.append(f"{product_name} {int(quantity)}L")
                                    else:  # unidades
                                        formatted_items.append(f"{product_name} {int(quantity)}U")
                                else:
                                    # Si no se encuentra el producto, usar formato básico
                                    formatted_items.append(f"{product_name} {int(quantity)}U")
                            except Exception:
                                # En caso de error, usar formato básico
                                formatted_items.append(f"{product_name} {int(quantity)}U")
                        elif product_name:
                            formatted_items.append(product_name)
                    elif isinstance(it, str):
                        # Si es un string, puede contener multiplicaciones - limpiar
                        clean_item = it.split(' x ')[0].split(' = ')[0].strip()
                        if clean_item:
                            formatted_items.append(clean_item)
                    else:
                        formatted_items.append(str(it))
                
                items_str = ', '.join(formatted_items)
            elif isinstance(items_field, str):
                # Si es string, puede contener multiplicaciones - limpiar
                clean_items = []
                parts = items_field.split(',')
                for part in parts:
                    clean_part = part.split(' x ')[0].split(' = ')[0].strip()
                    if clean_part:
                        clean_items.append(clean_part)
                items_str = ', '.join(clean_items)
            else:
                items_str = str(items_field or '')

            total_val = item.get('total') if item.get('total', None) is not None else (item.get('totalAmount') if item.get('totalAmount', None) is not None else item.get('total_amount', 0))
            
            # Procesar fecha de la misma manera que en movimientos de caja
            date_str = item.get('date', '')
            if date_str and '.' in date_str:
                date_str = date_str.split('.')[0]
            
            # Formatear fecha para que coincida con la interfaz gráfica
            formatted_date = format_date_for_pdf(date_str)
            
            table_data.append([
                item.get('id', ''),
                formatted_date,
                item.get('supplier', ''),
                items_str,
                f"${total_val}",
                item.get('type', '')
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

            # Procesar fecha de la misma manera que en movimientos de caja
            date_str = item.get('date', '')
            if date_str and '.' in date_str:
                date_str = date_str.split('.')[0]
            
            # Formatear fecha para que coincida con la interfaz gráfica
            formatted_date = format_date_for_pdf(date_str)

            table_data.append([
                item.get('id', ''),
                formatted_date,
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
        from reportlab.platypus import Paragraph
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        styles = getSampleStyleSheet()
        # Crear estilo específico para celdas de texto
        cell_style = ParagraphStyle(
            'CellStyle',
            parent=styles['Normal'],
            fontSize=7,
            alignment=1,  # Center alignment
            wordWrap='CJK',
            leftIndent=2,
            rightIndent=2,
            spaceAfter=2
        )
        
        table_data = [['ID', 'Nombre', 'CUIT', 'Teléfono', 'Dirección', 'Producto/Insumo']]
        for item in data:
            # No truncar el texto, dejarlo completo para que se ajuste automáticamente
            id_val = str(item.get('id', ''))
            name = str(item.get('name', ''))
            cuit = str(item.get('cuit', ''))
            phone = str(item.get('phone', ''))
            address = str(item.get('address', ''))
            products = str(item.get('products', ''))
            
            table_data.append([
                Paragraph(id_val, cell_style),
                Paragraph(name, cell_style),
                Paragraph(cuit, cell_style),
                Paragraph(phone, cell_style),
                Paragraph(address, cell_style),
                Paragraph(products, cell_style)
            ])
        
        # Ajustar anchos para incluir columna ID
        col_widths = [30, 70, 70, 60, 90, 190]  # Total: 510 puntos
        
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.beige, colors.lightgrey])
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

class ProductProductionView(APIView):
    permission_classes = [IsAuthenticated, IsGerente]

    def post(self, request, *args, **kwargs):
        product_id = request.data.get('product_id')
        quantity_produced = request.data.get('quantity_produced')

        if not product_id or not quantity_produced:
            return Response({'error': 'El ID del producto y la cantidad son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity_produced = int(quantity_produced)
            if quantity_produced <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return Response({'error': 'La cantidad debe ser un número entero positivo.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # 1. Obtener el producto a producir
                product_to_produce = get_object_or_404(Product.objects.select_for_update(), pk=product_id)

                if product_to_produce.is_ingredient:
                    raise ValidationError('No se pueden producir insumos, solo productos finales.')

                # 2. Obtener la receta del producto
                recipe = product_to_produce.recipe.all()
                if not recipe.exists():
                    raise ValidationError('El producto no tiene una receta definida y no puede ser producido.')

                # 3. Verificar stock de ingredientes
                for recipe_item in recipe:
                    ingredient = recipe_item.ingredient
                    required_quantity = recipe_item.quantity * quantity_produced
                    
                    # Bloquear el ingrediente para la actualización
                    ingredient_to_update = Product.objects.select_for_update().get(pk=ingredient.pk)

                    if ingredient_to_update.stock < required_quantity:
                        raise ValidationError(f'Stock insuficiente para el insumo "{ingredient.name}". Necesario: {required_quantity:.2f} {recipe_item.unit}, Disponible: {ingredient_to_update.stock:.2f} {recipe_item.unit}')

                # 4. Descontar stock de ingredientes y aumentar stock del producto final
                for recipe_item in recipe:
                    ingredient = recipe_item.ingredient
                    required_quantity = recipe_item.quantity * quantity_produced
                    
                    ingredient_to_update = Product.objects.get(pk=ingredient.pk)
                    ingredient_to_update.stock -= required_quantity
                    ingredient_to_update.save()

                # 5. Aumentar el stock del producto producido
                product_to_produce.stock += quantity_produced
                product_to_produce.save()

            return Response({
                'success': f'Producción completada: {quantity_produced} unidades de {product_to_produce.name}.'
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({'error': e.detail[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Product.DoesNotExist:
            return Response({'error': 'El producto a producir no existe.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Ocurrió un error inesperado: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



