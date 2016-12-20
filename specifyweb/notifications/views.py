import json
from datetime import datetime, timedelta

from django.http import HttpResponse, HttpResponseBadRequest
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from ..specify.views import login_maybe_required
from ..specify.api import toJson

from .models import Message

@require_GET
@login_maybe_required
def get_messages(request):
    since = request.GET.get('since', None)
    time_filter = {'timestampcreated__gt': since} if since is not None else {}
    messages = Message.objects.filter(user=request.specify_user, **time_filter).order_by('timestampcreated')
    return HttpResponse(toJson([
        dict(message_id=m.id, read=m.read, timestamp=m.timestampcreated, **json.loads(m.content))
        for m in messages
    ]), content_type='application/json')

@require_POST
@login_maybe_required
@csrf_exempt
def mark_read(request):
    if 'last_seen' not in request.POST:
        return HttpResponseBadRequest()
    Message.objects.filter(user=request.specify_user, timestampcreated__lte=request.POST['last_seen']).update(read=True)

    delete_before = datetime.now() - timedelta(days=settings.NOTIFICATION_TTL_DAYS)
    Message.objects.filter(user=request.specify_user, timestampcreated__lt=delete_before).delete()
    return HttpResponse('OK', content_type='text/plain')

@require_POST
@login_maybe_required
@csrf_exempt
def delete(request):
    if 'message_id' not in request.POST:
        return HttpResponseBadRequest()
    Message.objects.filter(user=request.specify_user, id=request.POST['message_id']).delete()
    return HttpResponse('OK', content_type='text/plain')
